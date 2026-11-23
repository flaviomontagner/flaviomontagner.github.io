(() => {
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const watch = (el, cb, margin = '0px') => new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin: margin }).observe(el);
const once = (el, cb) => {
  if (!el) return;
  if (reduced || !('IntersectionObserver' in window)) { cb(); return; }
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { cb(); io.disconnect(); } }, { rootMargin: '0px 0px -25% 0px' });
  io.observe(el);
};
const phaseOf = h => h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 18 ? 'day' : h >= 18 && h < 21 ? 'dusk' : 'night';

/* Hero: a diorama built from the game's own models, lit by the visitor's clock. */
const stage = document.querySelector('[data-diorama]');
const T = window.THREE, MODELS = window.NECRO_GLB;
let setPhase = () => {}, bury = null;
if (stage && T && MODELS && T.GLTFLoader) {
  try {
    const canvas = stage.querySelector('[data-diorama-canvas]');
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    scene.fog = new T.Fog(0x0f1a22, 16, 34);
    const camera = new T.PerspectiveCamera(32, 1, .1, 100);
    camera.position.set(10.5, 6.6, 11.5);
    const target = new T.Vector3(0, .9, 0);
    const controls = new T.OrbitControls(camera, canvas);
    canvas.style.touchAction = 'pan-y';
    controls.target.copy(target);
    controls.enableZoom = false; controls.enablePan = false; controls.enableDamping = true;
    controls.minPolarAngle = .75; controls.maxPolarAngle = 1.32;
    controls.autoRotate = !reduced; controls.autoRotateSpeed = .35;

    const hemi = new T.HemisphereLight(0xffffff, 0x202020, 1);
    const sun = new T.DirectionalLight(0xffffff, 1);
    sun.position.set(-6, 10, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
    scene.add(hemi, sun);

    // the ground: a low-poly disc of grass on dark earth, like the shop previews
    const ground = new T.Mesh(new T.CylinderGeometry(5.6, 5.9, .55, 14),
      [new T.MeshStandardMaterial({ color: 0x3b2c22, flatShading: true, roughness: 1 }), new T.MeshStandardMaterial({ color: 0x3e6a3a, flatShading: true, roughness: 1 }), new T.MeshStandardMaterial({ color: 0x2a1f18 })]);
    ground.position.y = -.275; ground.receiveShadow = true; scene.add(ground);

    // fireflies, only at night
    const flyGeo = new T.BufferGeometry(), flyN = 46, flyPos = new Float32Array(flyN * 3), flySeed = [];
    for (let i = 0; i < flyN; i++) { const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4.6; flySeed.push([a, r, .3 + Math.random() * 2.2, Math.random() * 10]); }
    flyGeo.setAttribute('position', new T.BufferAttribute(flyPos, 3));
    const flies = new T.Points(flyGeo, new T.PointsMaterial({ color: 0xffd27a, size: .09, transparent: true, opacity: .9, depthWrite: false, blending: T.AdditiveBlending }));
    scene.add(flies);

    const loader = new T.GLTFLoader();
    const decode = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
    const lights = [];
    const prep = root => root.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      if (o.isPointLight) { o.distance = 3.5; o.decay = 2; lights.push(o); }
    });
    const load = name => new Promise((res, rej) => loader.parse(decode(MODELS[name]), '', g => { prep(g.scene); res(g.scene); }, rej));
    const place = (obj, x, z, rotY = 0, s = 1) => { obj.position.set(x, 0, z); obj.rotation.y = rotY; obj.scale.setScalar(s); scene.add(obj); return obj; };

    let keeper, ghost, graveTemplate, zombie, dog;
    const rigParts = (root, names) => Object.fromEntries(names.map(n => [n, root.getObjectByName(n)]));
    const parts = ['head','body','armL','armR','legL','legR'];
    Promise.all(['keeper-house-full','tree-broadleaf','tree-fir','cypress','bushes','lamp-post','keeper-custode','ghost','gravestone-celtic-cross','glow-pumpkin','pet-house-dog','pet-dog','zombie','fence-wood'].map(load))
      .then(([house, tree, fir, cypress, bush, lamp, keep, gh, grave, pump, kennel, dg, zb, fence]) => {
      place(house, -.7, -2.5, .2, .9);
      place(tree, -3.7, -1.5, .6);
      place(fir, 3.4, -2.7, 0, .95);
      place(cypress, -4.1, 1.4, 0, .9);
      place(bush, 3.7, .9, .4, .8);
      place(lamp, 2.3, -1.1, 0);
      keeper = place(keep, 1.3, 1.5, .75, 1.15);
      ghost = place(gh, -1.7, .7, .9, 1.05);
      graveTemplate = grave;
      place(grave.clone(true), 1.9, -2.6, -.25, .7);
      place(pump, 4, 1.9, -.4, .9);
      place(kennel, -2.9, 3, .75, .9);
      dog = { obj: place(dg, -1.9, 2.2, .5, 1.2), rig: rigParts(dg, parts), phase: 0, a: 0 };
      zombie = { obj: place(zb, 2.4, -.3, 0, 1.1), rig: rigParts(zb, parts), phase: 0, a: 0 };
      // a ring of wooden fence pieces around the lawn: pickets inward, rails outward
      const R = 5.35, N = 36, chord = 2 * Math.PI * R / N;
      for (let i = 0; i < N; i++) {
        const ang = i / N * Math.PI * 2, piece = i ? fence.clone(true) : fence;
        piece.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R);
        piece.rotation.y = -ang - Math.PI / 2;
        piece.scale.set(chord, .62, 1);
        scene.add(piece);
      }
      stage.classList.add('is-ready');
    }).catch(() => stage.classList.add('is-fallback'));

    // the game's grave puff (Effects.ts cloudPuff, dirt colours from Game.ts): 11 blobs in a ring and a core
    const puffGeo = new T.IcosahedronGeometry(1, 1), puffs = [];
    const cloudPuff = (x, z) => {
      const mat = new T.MeshLambertMaterial({ color: 0xa08a6c, emissive: 0x3a2e22, emissiveIntensity: .55, flatShading: true, transparent: true });
      const blobs = [];
      for (let i = 0; i < 12; i++) {
        const core = i === 11, a = i / 11 * Math.PI * 2 + Math.random() * .4, up = [.55, .05, -.35][i % 3];
        const m = new T.Mesh(puffGeo, mat);
        m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        m.scale.setScalar(.01);
        scene.add(m);
        blobs.push({ m, dir: core ? [0, .15, 0] : [Math.cos(a) * .42, up, Math.sin(a) * .42], size: core ? .42 : .24 + Math.random() * .12, delay: core ? 0 : Math.random() * .06 });
      }
      puffs.push({ x, z, blobs, mat, born: performance.now() });
    };
    const stepPuffs = t => {
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i], age = (t - p.born) / 1000;
        for (const b of p.blobs) {
          const k = Math.max(0, age - b.delay);
          const grow = k < .16 ? k / .16 * 1.15 : k < .26 ? 1.15 - (k - .16) / .1 * .15 : Math.max(0, 1 - (k - .26) / .69);
          const spread = .6 + k * 1.4;
          b.m.scale.setScalar(Math.max(.001, b.size * grow));
          b.m.position.set(p.x + b.dir[0] * spread, b.dir[1] * spread + .5 + k * .5, p.z + b.dir[2] * spread);
        }
        p.mat.opacity = age < .5 ? 1 : Math.max(0, 1 - (age - .5) / .45);
        if (age > 1) { p.blobs.forEach(b => scene.remove(b.m)); p.mat.dispose(); puffs.splice(i, 1); }
      }
    };

    // burials: a puff, then the headstone in a free plot at the front of the yard
    // free plots well inside the fence, so the near fence never hides a headstone; when they are taken, the yard is full
    const slots = [[2.6, 2.5], [.5, 2.6], [-.7, 1.7], [2.7, 3.4], [.9, 3.5], [-.5, 3.4], [-2.5, 3.5], [-1.2, 3.9]];
    const graves = [];
    let holdUntil = 0, hovering = false;
    let nextSlot = 0;
    bury = name => {
      if (!graveTemplate) return false;
      if (nextSlot >= slots.length) return 'full';
      const n = nextSlot, [x, z] = slots[n];
      cloudPuff(x, z);
      const obj = place(graveTemplate.clone(true), x, z, (Math.random() - .5) * .4, .62);
      obj.scale.setScalar(.001);
      // the grave's name and the game's own "bring flowers" button float above it
      const label = document.createElement('div');
      label.className = 'nc-grave';
      const nm = document.createElement('span'); nm.className = 'nc-grave-name'; nm.textContent = name;
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'nc-flower-btn';
      btn.setAttribute('aria-label', `Bring flowers to ${name}`);
      btn.innerHTML = '<img src="assets/necro-flower-icon.svg" alt="">';
      label.append(btn, nm);
      stage.appendChild(label);
      // only the newest grave keeps its name and flower button on screen
      graves.forEach(o => o && o.label.classList.add('is-past'));
      const g = { obj, label, born: performance.now(), x, z, flowers: null };
      btn.addEventListener('click', () => { bringFlowers(g); btn.disabled = true; holdUntil = performance.now() + 2500; });
      btn.addEventListener('pointerenter', () => { hovering = true; });
      btn.addEventListener('pointerleave', () => { hovering = false; holdUntil = performance.now() + 1200; });
      holdUntil = performance.now() + 7000;
      graves[n] = g;
      nextSlot++;
      return true;
    };

    // flowers at the foot of the headstone: low-poly blossoms on stems, popping in one by one
    const petal = new T.IcosahedronGeometry(.07, 0), stemGeo = new T.CylinderGeometry(.012, .012, .22, 4);
    const stemMat = new T.MeshLambertMaterial({ color: 0x5f8f4e, flatShading: true });
    const blossoms = [0xf3a6b8, 0xffffff, 0xf7d774, 0xe07a8a, 0xc9a7f0].map(c => new T.MeshLambertMaterial({ color: c, flatShading: true, emissive: c, emissiveIntensity: .18 }));
    const bringFlowers = g => {
      const grp = new T.Group(); grp.position.set(g.x, 0, g.z + .38); scene.add(grp);
      for (let i = 0; i < 9; i++) {
        const f = new T.Group(), a = (i / 9) * Math.PI - Math.PI / 2, r = .12 + (i % 3) * .07;
        f.position.set(Math.sin(a) * r * 1.6, 0, Math.cos(a) * r * .5);
        const st = new T.Mesh(stemGeo, stemMat); st.position.y = .11; f.add(st);
        const bl = new T.Mesh(petal, blossoms[i % blossoms.length]); bl.position.y = .24; f.add(bl);
        f.scale.setScalar(.001); f.userData.born = performance.now() + i * 70;
        grp.add(f);
      }
      g.flowers = grp;
      sparkle(g.x, .4, g.z + .38);
    };
    const sparkGeo = new T.BufferGeometry(), sparks = [];
    const sparkle = (x, y, z) => {
      const n = 18, pos = new Float32Array(n * 3), vel = [];
      for (let i = 0; i < n; i++) { pos.set([x, y, z], i * 3); vel.push([(Math.random() * 2 - 1) * .8, .5 + Math.random() * 1.6, (Math.random() * 2 - 1) * .8]); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      const pts = new T.Points(geo, new T.PointsMaterial({ color: 0xffd6e2, size: .1, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      scene.add(pts); sparks.push({ pts, vel, born: performance.now() });
    };
    const stepFlowers = t => {
      for (const g of graves) if (g && g.flowers) for (const f of g.flowers.children) {
        const k = Math.min(1, Math.max(0, (t - f.userData.born) / 300));
        f.scale.setScalar(Math.max(.001, k < 1 ? k * (1 + Math.sin(k * Math.PI) * .25) : 1));
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i], life = (t - sp.born) / 900, a = sp.pts.geometry.attributes.position;
        sp.vel.forEach((v, j) => { a.array[j*3] += v[0] * .016; a.array[j*3+1] += v[1] * .016; a.array[j*3+2] += v[2] * .016; v[1] -= .03; });
        a.needsUpdate = true; sp.pts.material.opacity = Math.max(0, 1 - life);
        if (life >= 1) { scene.remove(sp.pts); sparks.splice(i, 1); }
      }
    };

    const looks = {
      dawn:  { bg: 0x3b3346, fog: 0x3b3346, sky: 0xffc2a0, gnd: 0x2f2a2a, hemi: 1.1, sun: 0xffd2a0, sunI: 1.8, sunPos: [-9, 4, 6], lamps: .5, flies: 0 },
      day:   { bg: 0x9ab9c6, fog: 0x9ab9c6, sky: 0xeaf3f6, gnd: 0x4a5a3a, hemi: 1.6, sun: 0xfff1d6, sunI: 2.6, sunPos: [-5, 11, 6], lamps: 0, flies: 0 },
      dusk:  { bg: 0x40283a, fog: 0x40283a, sky: 0xf08f78, gnd: 0x2a2228, hemi: .9, sun: 0xff9f6e, sunI: 1.4, sunPos: [8, 3.5, 4], lamps: .8, flies: .4 },
      night: { bg: 0x0f1a22, fog: 0x0f1a22, sky: 0x5577a0, gnd: 0x101418, hemi: .55, sun: 0xa8c4e6, sunI: .7, sunPos: [-6, 9, 4], lamps: 1.3, flies: 1 },
    };
    let look = looks.night;
    const buttons = [...document.querySelectorAll('[data-phase]')];
    setPhase = p => {
      look = looks[p];
      renderer.setClearColor(look.bg); scene.fog.color.setHex(look.fog);
      hemi.color.setHex(look.sky); hemi.groundColor.setHex(look.gnd); hemi.intensity = look.hemi;
      sun.color.setHex(look.sun); sun.intensity = look.sunI; sun.position.set(...look.sunPos);
      flies.material.opacity = look.flies; flies.visible = look.flies > 0;
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.phase === p)));
    };
    buttons.forEach(b => b.addEventListener('click', () => setPhase(b.dataset.phase)));
    setPhase('dusk');

    // Frame the yard close: the ring may run past the edges, the world fills the hero. Clear of the title on desktop.
    const resize = () => {
      const { width, height } = stage.getBoundingClientRect();
      const wide = width > 1020;
      renderer.setSize(width, height, false);
      camera.zoom = wide ? 1.18 : Math.min(1, width / (height * 1.6)) * 1.8;
      camera.setViewOffset(width, height, wide ? -width * .22 : 0, wide ? height * .06 : -height * .1, width, height);
    };
    resize(); addEventListener('resize', resize);

    // walk cycles from the game's rigs (characters.ts animateRig): the zombie limps, the dog trots
    const face = (o, dx, dz) => { o.rotation.y = Math.atan2(dx, dz); };
    const walkZombie = dt => {
      const z = zombie, r = z.rig;
      z.phase += .85 * dt * 2.6;
      const swing = Math.sin(z.phase * 2.2), step = Math.max(0, swing);
      const lurch = .28 + 1.05 * Math.max(0, Math.sin(z.phase * 2.2));
      z.a += dt * .16 * lurch;
      const cx = .3, cz = -.2, rx = 3, rz = 1.15;
      const x = cx + Math.cos(z.a) * rx, zz = cz + Math.sin(z.a) * rz;
      face(z.obj, -Math.sin(z.a) * rx, Math.cos(z.a) * rz);
      z.obj.position.set(x, 0, zz);
      if (r.legL) r.legL.rotation.x = swing * .75;
      if (r.legR) r.legR.rotation.set(.12 - step * .18, 0, .12);
      if (r.armL) r.armL.rotation.set(-1.45 + swing * .12, 0, -.08);
      if (r.armR) r.armR.rotation.set(-1.25 - swing * .08, 0, .15);
      if (r.body) r.body.rotation.set(.12, 0, .1 + step * .08);
      if (r.head) r.head.rotation.set(.22 + step * .1, 0, .28 - step * .12);
    };
    // the dog stays by its kennel and only looks around (the game's idle: head.x = sin(t*0.8)*0.15)
    const walkDog = dt => {
      dog.a += dt;
      if (dog.rig.head) { dog.rig.head.rotation.x = Math.sin(dog.a * .8) * .15; dog.rig.head.rotation.y = Math.sin(dog.a * .37) * .35; }
    };


    const v = new T.Vector3();
    let raf = 0;
    const frame = t => {
      const s = t / 1000;
      controls.autoRotate = !reduced && !hovering && t > holdUntil;
      controls.update();
      lights.forEach(l => { l.intensity = look.lamps * (2.2 + (reduced ? 0 : Math.sin(s * 9 + l.id) * .25)); });
      if (ghost && !reduced) { ghost.position.y = .35 + Math.sin(s * 1.4) * .14; ghost.rotation.y = .9 + Math.sin(s * .5) * .3; }
      if (keeper && !reduced) keeper.rotation.z = Math.sin(s * 1.1) * .02;
      const dt = Math.min(.05, (t - (frame.last || t)) / 1000); frame.last = t;
      if (zombie && !reduced) walkZombie(dt);
      if (dog && !reduced) walkDog(dt);
      stepPuffs(t);
      stepFlowers(t);
      if (flies.visible) {
        for (let i = 0; i < flyN; i++) { const [a, r, h, p] = flySeed[i]; const aa = a + s * .08; flyPos.set([Math.cos(aa) * r, h + Math.sin(s * .9 + p) * .25, Math.sin(aa) * r], i * 3); }
        flyGeo.attributes.position.needsUpdate = true;
      }
      const rect = stage.getBoundingClientRect();
      for (const g of graves) {
        if (!g) continue;
        const k = Math.min(1, Math.max(0, (t - g.born - 120) / 380));
        const pop = k < 1 ? 1 + Math.sin(k * Math.PI) * .18 * (1 - k) : 1;
        g.obj.scale.setScalar(Math.max(.001, .62 * Math.min(1, k * 1.4) * pop));
        v.set(g.x, 1.15, g.z).project(camera);
        g.label.style.transform = `translate(${(v.x * .5 + .5) * rect.width}px,${(-v.y * .5 + .5) * rect.height}px) translate(-50%,-100%)`;
        g.label.style.opacity = v.z < 1 ? 1 : 0;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    watch(stage, on => { if (on && !raf) raf = requestAnimationFrame(frame); if (!on) { cancelAnimationFrame(raf); raf = 0; } });
  } catch (e) {
    stage.classList.add('is-fallback');
  }
} else if (stage) stage.classList.add('is-fallback');

const form = document.querySelector('[data-bury]');
if (form) {
  const out = document.querySelector('[data-bury-out]');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const input = form.querySelector('input');
    const name = input.value.trim() || input.placeholder;
    const result = bury && bury(name);
    if (result === 'full') {
      out.textContent = 'The yard is full. Every plot has someone, or something, resting in it.';
      form.querySelector('button').disabled = true; input.value = ''; input.disabled = true;
    } else if (result) {
      out.innerHTML = '';
      const b = document.createElement('b'); b.textContent = name;
      out.append(b, ' is laid to rest. ');
      const em = document.createElement('em'); em.textContent = '+5 wisps'; out.append(em, '. Bring it flowers.');
      input.value = '';
    } else out.textContent = 'The yard is still loading. Try again in a moment.';
  });
}

/* First session: the ten steps light up one after another, like the yard's spotlight. */
const steps = document.querySelector('[data-steps]');
if (steps) {
  const items = [...steps.children];
  if (reduced) items.forEach(i => i.classList.add('is-done'));
  else {
    let k = 0, timer = 0;
    const tick = () => {
      items.forEach((it, j) => { it.classList.toggle('is-done', j < k); it.classList.toggle('is-now', j === k); });
      k = (k + 1) % (items.length + 2);
      timer = setTimeout(tick, k === 0 ? 1600 : 650);
    };
    watch(steps, on => { clearTimeout(timer); if (on) tick(); });
  }
}

/* Balance: the bars grow when the chart is reached. */
const ranks = document.querySelector('.nc-ranks');
if (ranks && !reduced) { ranks.classList.add('is-waiting'); once(ranks, () => ranks.classList.remove('is-waiting')); }

/* World: the clock shows the visitor's time and the phase it would be in the game. */
const clock = document.querySelector('[data-dial]');
if (clock) {
  const now = new Date(), h = now.getHours() + now.getMinutes() / 60;
  clock.querySelector('[data-hand]').style.transform = `rotate(${h / 24 * 360}deg)`;
  const p = phaseOf(now.getHours());
  clock.querySelector('[data-dial-now]').textContent = `Your time ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} · it is ${p} in the game`;
}
})();
