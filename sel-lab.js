(() => {
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const inView = (el, cb, margin = '0px') => new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin: margin }).observe(el);

/* Hero: move the character, the room answers. Speed of motion → activation → zone and light. */
const room = document.querySelector('[data-room]');
if (room) {
  const handle = room.querySelector('[data-char]');
  const zoneLabel = room.querySelector('[data-zone]');
  const canvas = room.querySelector('[data-trace]');
  const ctx = canvas.getContext('2d');
  const zones = [
    [0, 'Under-activation', '#f3ecdc'],
    [.25, 'Optimal zone', '#3fb8a6'],
    [.6, 'High activation', '#f2b544'],
    [.82, 'Possible overload', '#e0645c'],
  ];
  // the light follows activation continuously: warm white → green → amber → red, and back the same way
  const stops = [[0,[243,236,220]],[.16,[243,236,220]],[.34,[63,184,166]],[.62,[242,181,68]],[.85,[224,100,92]]];
  const lightAt = v => { let i = stops.length - 2; while (i > 0 && v < stops[i][0]) i--; const [a0,c0] = stops[i], [a1,c1] = stops[i+1]; const k = clamp((v - a0) / (a1 - a0)); return c0.map((c,j) => c + (c1[j] - c) * k); };
  let shown = [243,236,220];
  const hexOf = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
  let x = .5, y = .48, act = .1, peak = 0, recoveryUntil = 0;
  let dragging = false, last = null, lastInput = performance.now(), visible = false, frame = 0, tilt = 0;
  const trace = Array(120).fill(.1);

  const place = () => {
    room.style.setProperty('--cx', `${x * 100}%`);
    room.style.setProperty('--cy', `${y * 100}%`);
    room.style.setProperty('--lx', `${x * 100}%`);
  };
  // Activation follows how fast the character is moving (smoothed), so a slow drag stays calm.
  let speedAvg = 0;
  const push = speed => { speedAvg = speedAvg * .7 + speed * .3; };
  const move = (nx, ny, t) => {
    nx = clamp(nx, .16, .84); ny = clamp(ny, .2, .62);
    if (last) {
      const r = room.getBoundingClientRect();
      const dx = (nx - last.x) * r.width, dy = (ny - last.y) * r.height, dt = Math.max(8, t - last.t);
      push(Math.hypot(dx, dy) / dt);
      tilt = clamp(dx / dt * 14, -18, 18);
      spin(dx, dy);
    }
    last = { x: nx, y: ny, t };
    x = nx; y = ny; lastInput = t;
  };
  const toLocal = e => { const r = room.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };

  handle.addEventListener('pointerdown', e => {
    dragging = true; last = null;
    handle.setPointerCapture(e.pointerId);
    move(...toLocal(e), performance.now());
    e.preventDefault();
  });
  handle.addEventListener('pointermove', e => { if (dragging) move(...toLocal(e), performance.now()); });
  const release = () => { dragging = false; last = null; };
  handle.addEventListener('pointerup', release);
  handle.addEventListener('pointercancel', release);
  handle.addEventListener('keydown', e => {
    const step = { ArrowLeft: [-.06, 0], ArrowRight: [.06, 0], ArrowUp: [0, -.06], ArrowDown: [0, .06] }[e.key];
    if (!step) return;
    e.preventDefault();
    last = { x, y, t: performance.now() - 40 };
    move(x + step[0], y + step[1], performance.now());
    last = null;
  });

  // When nobody has touched it for a while, the character plays a short scripted session on its own.
  let demoStart = 0;
  // The demo follows a path whose phase accumulates over time (no jumps when the rhythm changes),
  // and the character eases towards it from wherever it was left.
  let phase = 0, lastAuto = 0, follow = 0;
  const autopilot = t => {
    if (!demoStart) { demoStart = t; lastAuto = t; follow = 0; }
    const dt = Math.min(64, t - lastAuto); lastAuto = t;
    const s = ((t - demoStart) / 1000) % 16;
    const energy = s < 4 ? .3 : s < 7.5 ? 3.5 : s < 10 ? 9 : .2;
    phase += dt / 1000 * energy * 2.2;
    const amp = Math.min(energy, 1.6);
    const tx = .5 + Math.sin(phase) * .14 * amp;
    const ty = .44 + Math.cos(phase * 1.37) * .06 * amp;
    follow = Math.min(1, follow + dt / 1800);
    const k = .03 + .17 * follow;
    const nx = x + (tx - x) * k, ny = y + (ty - y) * k;
    const r = room.getBoundingClientRect(), d = Math.max(8, dt);
    const dx = (nx - x) * r.width, dy = (ny - y) * r.height;
    push(Math.hypot(dx, dy) / d);
    tilt = clamp(dx / d * 14, -18, 18);
    spin(dx, dy);
    x = nx; y = ny; last = null;
  };

  const drawTrace = colour => {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 1;
    [.25, .6, .82].forEach(v => { ctx.beginPath(); ctx.moveTo(0, h - v * h); ctx.lineTo(w, h - v * h); ctx.stroke(); });
    ctx.beginPath();
    trace.forEach((v, i) => { const px = i / (trace.length - 1) * w, py = h - 2 - v * (h - 4); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.strokeStyle = colour; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
  };

  let lastSample = 0;

  /* The character: the project's 3D model drawn with a small WebGL renderer (no library, works from file://). */
  const glCanvas = room.querySelector('[data-gl]');
  const rot = { yaw: 0, pitch: 0, roll: 0, vy: 0, vp: 0, vr: 0 };
  const spin = (dx, dy) => { rot.vy += dx * .0035; rot.vp += dy * .003; rot.vr -= dx * .0025; };
  // Two layers: the room on a canvas blurred with CSS (depth of field), the character sharp on top.
  const makeRenderer = (glCanvas, layer) => {
    const M = window.SEL_MODEL;
    const gl = glCanvas && M && glCanvas.getContext('webgl', { antialias: true, alpha: layer === 'char', premultipliedAlpha: true });
    if (!gl) return null;
    const dec = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
    const q = (s, k) => Float32Array.from(new Int16Array(dec(s)), v => v / 32767 * k);
    const shader = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, `
      attribute vec3 p; attribute vec3 n;
      uniform mat4 uM; uniform mat4 uP; uniform vec2 uOff; uniform float uS; uniform float uZ; uniform float uLift;
      varying vec3 vN; varying vec3 vW;
      void main(){ vec4 w = uM * vec4(p * uS, 1.0); w.z += uZ; w.y += uLift; vN = mat3(uM) * n; vW = w.xyz;
        vec4 c = uP * w; c.xy += uOff * c.w; gl_Position = c; }`));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec3 vN; varying vec3 vW;
      uniform vec3 uGlow; uniform vec3 uBase; uniform float uAct; uniform int uKind; uniform vec3 uLight;
      void main(){
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(-vW);
        vec3 lightCol = mix(vec3(1.0, .93, .82), uGlow, .22 + .5 * uAct) * (.75 + .7 * uAct);
        if (uKind == 2) { gl_FragColor = vec4(mix(vec3(1.0, .93, .78), uGlow, .35 + .5 * uAct) * (.85 + .3 * uAct), 1.0); return; }
        if (uKind == 1) {
          vec3 L = uLight - vW; float d = length(L);
          float diff = max(dot(N, L / d), 0.0) / (1.0 + .06 * d * d);
          float spill = smoothstep(2.6, 0.0, length(vW.xy - vec2(0.0, .4))) * .35 * uAct;
          vec3 col = uBase * (.34 + diff * lightCol * 1.9) + uGlow * spill * .3;
          gl_FragColor = vec4(col, 1.0); return;
        }
        vec3 L = normalize(vec3(-.45, .8, .55));
        float wrap = max((dot(N, L) + .55) / 1.55, 0.0);
        vec3 col = uBase * (.32 + .7 * wrap);
        col += pow(max(dot(N, normalize(L + V)), 0.0), 36.0) * .2;
        float rim = pow(1.0 - max(dot(N, V), 0.0), 2.2);
        col += uGlow * rim * (.2 + .95 * uAct);
        gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
      }`));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const aP = gl.getAttribLocation(prog, 'p'), aN = gl.getAttribLocation(prog, 'n');
    gl.enableVertexAttribArray(aP); gl.enableVertexAttribArray(aN);
    const mesh = (pos, nor, idx) => {
      const mk = (data, target) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
      return { p: mk(pos, gl.ARRAY_BUFFER), n: mk(nor, gl.ARRAY_BUFFER), i: mk(idx, gl.ELEMENT_ARRAY_BUFFER), count: idx.length };
    };
    const characterParts = (M.parts || [M]).map(pt => ({ m: mesh(q(pt.pos, M.range || 1), q(pt.nor, 1), new Uint16Array(dec(pt.idx))), dark: !!pt.dark }));
    // A simple living room in camera space: warm walls, a sofa and an armchair, a coffee table on a rug,
    // a bookcase, a plant, a picture and a floor lamp whose shade glows with the room's light.
    const quad = (list, a, b, c, d, n) => list.push([a, b, c, d, n]);
    const F = -1.15, T = 2.3, X = 3.1, Zf = -2.5, Zb = -9.5;
    const build = list => {
      const pos = [], nor = [], idx = [];
      list.forEach(([a, b, c, d, n], k) => { pos.push(...a, ...b, ...c, ...d); for (let i = 0; i < 4; i++) nor.push(...n); const o = k * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3); });
      return mesh(new Float32Array(pos), new Float32Array(nor), new Uint16Array(idx));
    };
    const box = (list, x0, x1, y0, y1, z0, z1) => {
      quad(list, [x0,y1,z1], [x1,y1,z1], [x1,y1,z0], [x0,y1,z0], [0,1,0]);
      quad(list, [x0,y0,z1], [x1,y0,z1], [x1,y1,z1], [x0,y1,z1], [0,0,1]);
      quad(list, [x1,y0,z0], [x0,y0,z0], [x0,y1,z0], [x1,y1,z0], [0,0,-1]);
      quad(list, [x0,y0,z0], [x0,y0,z1], [x0,y1,z1], [x0,y1,z0], [-1,0,0]);
      quad(list, [x1,y0,z1], [x1,y0,z0], [x1,y1,z0], [x1,y1,z1], [1,0,0]);
    };
    const solid = tris => {
      const pos = [], nor = [], idx = [];
      tris.forEach(([a, b, c], k) => {
        const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], v = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
        let n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]; const l = Math.hypot(...n) || 1; n = n.map(q => q / l);
        pos.push(...a, ...b, ...c); nor.push(...n, ...n, ...n); idx.push(k * 3, k * 3 + 1, k * 3 + 2);
      });
      return mesh(new Float32Array(pos), new Float32Array(nor), new Uint16Array(idx));
    };
    const ball = (cx, cy, cz, r, sx = 1, sy = 1) => {
      const tris = [], seg = 7, ring = 5;
      const pt = (i, j) => { const th = i / seg * Math.PI * 2, ph = j / ring * Math.PI; return [cx + Math.cos(th) * Math.sin(ph) * r * sx, cy + Math.cos(ph) * r * sy, cz + Math.sin(th) * Math.sin(ph) * r]; };
      for (let i = 0; i < seg; i++) for (let j = 0; j < ring; j++) { const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1); tris.push([a, c, b], [a, d, c]); }
      return tris;
    };
    const one = fn => { const l = []; fn(l); return build(l); };
    // walls, floor and ceiling, each with its own colour
    const floor = one(l => quad(l, [-X,F,Zf], [X,F,Zf], [X,F,Zb], [-X,F,Zb], [0,1,0]));
    const back = one(l => quad(l, [-X,F,Zb], [X,F,Zb], [X,T,Zb], [-X,T,Zb], [0,0,1]));
    const sides = one(l => { quad(l, [-X,F,Zf], [-X,F,Zb], [-X,T,Zb], [-X,T,Zf], [1,0,0]); quad(l, [X,F,Zb], [X,F,Zf], [X,T,Zf], [X,T,Zb], [-1,0,0]); });
    const ceiling = one(l => quad(l, [-X,T,Zb], [X,T,Zb], [X,T,Zf], [-X,T,Zf], [0,-1,0]));
    const skirting = one(l => { box(l, -X, X, F, F + .1, Zb, Zb + .04); box(l, -X, -X + .04, F, F + .1, Zb, Zf); box(l, X - .04, X, F, F + .1, Zb, Zf); });
    // sofa against the back wall
    const sofa = one(l => { box(l, -1.55, 1.25, F, -.72, -9.45, -8.4); box(l, -1.55, 1.25, -.72, .02, -9.45, -9.1); box(l, -1.8, -1.55, F, -.45, -9.45, -8.4); box(l, 1.25, 1.5, F, -.45, -9.45, -8.4); });
    const cushions = one(l => { box(l, -1.35, -.6, -.72, -.25, -9.12, -8.95); box(l, .35, 1.05, -.72, -.25, -9.12, -8.95); });
    // armchair on the right, turned towards the room
    const chair = one(l => { box(l, 1.75, 2.75, F, -.7, -7.6, -6.6); box(l, 2.55, 2.85, -.7, .05, -7.6, -6.6); box(l, 1.75, 2.75, F, -.4, -7.75, -7.55); box(l, 1.75, 2.75, F, -.4, -6.65, -6.45); });
    // coffee table, rug, a stack of books and a mug on the table
    const table = one(l => { box(l, -.85, .85, -.74, -.66, -7.75, -6.95); for (const [lx, lz] of [[-.78,-7.68],[.78,-7.68],[-.78,-7.02],[.78,-7.02]]) box(l, lx - .04, lx + .04, F, -.74, lz - .04, lz + .04); });
    const rug = one(l => quad(l, [-1.9,F + .005,-6.3], [1.6,F + .005,-6.3], [1.6,F + .005,-8.3], [-1.9,F + .005,-8.3], [0,1,0]));
    const tableThings = one(l => { box(l, -.55, -.15, -.66, -.6, -7.5, -7.2); box(l, -.5, -.2, -.6, -.55, -7.48, -7.22); box(l, .3, .42, -.66, -.52, -7.4, -7.28); });
    // bookcase on the left wall, with books of different heights and colours
    const caseX0 = -X + .02, caseX1 = -X + .55, cz0 = -8.9, cz1 = -6.9;
    const shelves = one(l => {
      box(l, caseX0, caseX1, F, 1.35, cz0, cz0 + .06); box(l, caseX0, caseX1, F, 1.35, cz1 - .06, cz1);
      box(l, caseX0, caseX0 + .04, F, 1.35, cz0, cz1);
      for (const y of [F, -.55, .05, .65, 1.29]) box(l, caseX0, caseX1, y, y + .06, cz0, cz1);
    });
    const bookColours = [[.7,.32,.26],[.24,.42,.55],[.85,.68,.35],[.36,.5,.36],[.55,.36,.5],[.82,.78,.7]];
    const books = bookColours.map(() => []);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const y of [F + .06, -.49, .11, .71]) {
      let z = cz0 + .1;
      while (z < cz1 - .25) {
        const w = .06 + rnd() * .07, h = .34 + rnd() * .18;
        if (rnd() > .12) box(books[Math.floor(rnd() * books.length)], caseX0 + .08, caseX1 - .06, y, y + h, z, z + w);
        z += w + .01 + (rnd() > .85 ? .12 : 0);
      }
    }
    // plant in a pot, picture above the sofa, floor lamp beside it
    const pot = one(l => box(l, 1.95, 2.4, F, -.72, -9.0, -8.55));
    const leaves = solid([...ball(2.18, -.25, -8.78, .48, 1, 1.15), ...ball(2.0, .2, -8.75, .3), ...ball(2.37, .12, -8.8, .28)]);
    const frame = one(l => box(l, -1.05, .75, .5, 1.55, -9.5, -9.44));
    const art = one(l => { quad(l, [-.95,.6,-9.43], [.65,.6,-9.43], [.65,1.45,-9.43], [-.95,1.45,-9.43], [0,0,1]); });
    const artShapes = one(l => { quad(l, [-.85,.65,-9.42], [-.1,.65,-9.42], [-.1,1.2,-9.42], [-.85,1.2,-9.42], [0,0,1]); });
    const lamp = one(l => { box(l, -2.35, -1.95, F, F + .04, -9.1, -8.7); box(l, -2.17, -2.13, F, .35, -8.92, -8.88); });
    const shade = solid((() => { const t = [], seg = 10, cx = -2.15, cz = -8.9, y0 = .3, y1 = .72, r0 = .32, r1 = .2;
      for (let i = 0; i < seg; i++) { const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
        const p = (a, y, r) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
        t.push([p(a0,y0,r0), p(a1,y0,r0), p(a1,y1,r1)], [p(a0,y0,r0), p(a1,y1,r1), p(a0,y1,r1)]); }
      return t; })());
    const furniture = [
      [floor, [.62, .5, .4]], [back, [.93, .86, .76]], [sides, [.88, .8, .7]], [ceiling, [.95, .92, .86]], [skirting, [.97, .95, .9]],
      [rug, [.78, .62, .5]], [sofa, [.47, .58, .55]], [cushions, [.9, .74, .48]], [chair, [.78, .5, .4]],
      [table, [.55, .4, .28]], [tableThings, [.86, .82, .74]], [shelves, [.6, .45, .32]],
      ...books.map((b, i) => [build(b), bookColours[i]]),
      [pot, [.72, .45, .33]], [leaves, [.36, .55, .38]], [frame, [.3, .26, .22]], [art, [.95, .9, .8]], [artShapes, [.42, .6, .62]], [lamp, [.25, .23, .2]],
    ];
    const u = name => gl.getUniformLocation(prog, name);
    const U = Object.fromEntries(['uM','uP','uOff','uS','uZ','uLift','uGlow','uBase','uAct','uKind','uLight'].map(n => [n, u(n)]));
    gl.enable(gl.DEPTH_TEST);
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const mul = (a, b) => { const o = new Array(16); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
    const rx = t => [1,0,0,0, 0,Math.cos(t),Math.sin(t),0, 0,-Math.sin(t),Math.cos(t),0, 0,0,0,1];
    const ry = t => [Math.cos(t),0,-Math.sin(t),0, 0,1,0,0, Math.sin(t),0,Math.cos(t),0, 0,0,0,1];
    const rz = t => [Math.cos(t),Math.sin(t),0,0, -Math.sin(t),Math.cos(t),0,0, 0,0,1,0, 0,0,0,1];
    const I = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    const FACE = -Math.PI / 2; // the model is exported side-on; turn it to face the camera
    const draw = (m, kind) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, m.p); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.n); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i);
      gl.uniform1i(U.uKind, kind);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
    };
    let w = 0, h = 0;
    return (cx, cy, colour, a, lift) => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const cw = Math.round(glCanvas.clientWidth * dpr), ch = Math.round(glCanvas.clientHeight * dpr);
      if (cw !== w || ch !== h) { w = glCanvas.width = cw; h = glCanvas.height = ch; gl.viewport(0, 0, w, h); }
      const f = 1 / Math.tan(Math.PI / 6.4), asp = w / h, near = .1, far = 50;
      gl.uniformMatrix4fv(U.uP, false, [f / asp,0,0,0, 0,f,0,0, 0,0,(far + near) / (near - far),-1, 0,0,2 * far * near / (near - far),0]);
      gl.uniform3fv(U.uGlow, hex(colour));
      gl.uniform1f(U.uAct, a);
      gl.uniform3f(U.uLight, -.3, 1.9, -6.2);
      if (layer === 'room') {
        gl.clearColor(.2, .17, .14, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix4fv(U.uM, false, I); gl.uniform2f(U.uOff, 0, 0); gl.uniform1f(U.uS, 1); gl.uniform1f(U.uZ, 0); gl.uniform1f(U.uLift, 0);
        for (const [m, c] of furniture) { gl.uniform3fv(U.uBase, c); draw(m, 1); }
        draw(shade, 2);
        return;
      }
      // character, on its own transparent layer, at its own scale and position
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(U.uM, false, mul(rz(rot.roll), mul(rx(rot.pitch), ry(rot.yaw + FACE))));
      gl.uniform2f(U.uOff, (cx - .5) * 2, (.5 - cy) * 2);
      gl.uniform1f(U.uS, 1.12); gl.uniform1f(U.uZ, -6); gl.uniform1f(U.uLift, lift);
      for (const part of characterParts) { if (part.dark) gl.uniform3f(U.uBase, .05, .05, .06); else gl.uniform3f(U.uBase, .97, .965, .95); draw(part.m, 0); }
    };
  };
  const drawRoom = makeRenderer(room.querySelector('[data-gl-room]'), 'room');
  const drawChar = makeRenderer(glCanvas, 'char');
  const draw3d = drawRoom && drawChar ? (...args) => { drawRoom(...args); drawChar(...args); } : null;
  if (draw3d) room.classList.add('has-gl');
  // Springs bring the character back to facing the viewer; it never spins on its own.
  const stepSpring = () => {
    rot.vp += -.05 * rot.pitch - .1 * rot.vp;
    rot.vr += -.05 * rot.roll - .1 * rot.vr;
    rot.vy += -.045 * rot.yaw - .09 * rot.vy;
    rot.pitch = clamp(rot.pitch + rot.vp, -.9, .9);
    rot.roll = clamp(rot.roll + rot.vr, -.9, .9);
    rot.yaw = clamp(rot.yaw + rot.vy, -1.2, 1.2);
  };
  let calmLift = 0;

  const tick = t => {
    frame = 0;
    const idle = t - lastInput > 5000;
    if (!dragging && idle && !reduced) autopilot(t); else demoStart = 0;
    speedAvg *= .9;
    const targetAct = clamp(.1 + speedAvg * .36);
    act = clamp(act + (targetAct - act) * (targetAct > act ? .05 : .025));
    tilt *= .9;
    if (act > .6) peak = act;
    if (peak > .6 && act < .6) { recoveryUntil = t + 2600; peak = 0; }
    let [, label] = zones.filter(([min]) => act >= min).pop();
    if (t < recoveryUntil && act < .6) label = 'Recovery phase';
    shown = shown.map((c, j) => c + (lightAt(act)[j] - c) * .08);
    const colour = hexOf(shown);
    if (zoneLabel.textContent !== label) zoneLabel.textContent = label;
    room.style.setProperty('--act', act.toFixed(3));
    room.style.setProperty('--glow', colour);
    room.style.setProperty('--tilt', `${draw3d ? 0 : tilt.toFixed(1)}deg`);
    place();
    if (draw3d) {
      stepSpring();
      const target = (!dragging && act < .3 && !reduced) ? Math.sin(t / 950) * .07 : 0;
      calmLift += (target - calmLift) * .08;
      draw3d(x, y, colour, act, calmLift);
    }
    if (t - lastSample > 60) { trace.push(act); trace.shift(); lastSample = t; drawTrace(colour); }
    if (visible) frame = requestAnimationFrame(tick);
  };
  place();
  drawTrace('#f3ecdc');
  if (draw3d) draw3d(x, y, '#f3ecdc', act, 0);
  inView(room, on => { visible = on; if (on && !frame) frame = requestAnimationFrame(tick); });
}

/* One-shot reveals */
const reveal = (el, margin = '0px 0px -25% 0px') => {
  if (!el || reduced || !('IntersectionObserver' in window)) return;
  el.classList.add('is-waiting');
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.remove('is-waiting'); io.disconnect(); } }, { rootMargin: margin });
  io.observe(el);
};
reveal(document.querySelector('[data-strike-line]'));
reveal(document.querySelector('[data-weights]'));

/* The loop: a dot travels child → character → room → adult and lights each in turn. */
const loop = document.querySelector('[data-loop]');
if (loop) {
  const runner = loop.querySelector('.sl-runner');
  const nodes = [...loop.querySelectorAll('.sl-node')];
  const items = [...document.querySelectorAll('.sl-loop-list [data-node]')];
  const light = i => {
    nodes.forEach((n, j) => n.classList.toggle('is-on', j === i));
    items.forEach((n, j) => n.classList.toggle('is-on', j === i));
  };
  if (reduced) { nodes.forEach(n => n.classList.add('is-on')); }
  else {
    let raf = 0, start = 0;
    const step = t => {
      if (!start) start = t;
      const a = ((t - start) / 9000) % 1 * Math.PI * 2 - Math.PI / 2;
      runner.setAttribute('cx', (200 + Math.cos(a) * 150).toFixed(1));
      runner.setAttribute('cy', (200 + Math.sin(a) * 150).toFixed(1));
      const quarter = Math.round(((a + Math.PI / 2) / (Math.PI * 2)) * 4) % 4;
      light(quarter);
      raf = requestAnimationFrame(step);
    };
    inView(loop, on => { if (on && !raf) raf = requestAnimationFrame(step); if (!on) { cancelAnimationFrame(raf); raf = 0; } });
  }
}

})();
