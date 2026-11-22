(() => {
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width:1020px)').matches;
const watch = (el, cb) => new IntersectionObserver(([e]) => cb(e.isIntersecting)).observe(el);

/* Hero: the head, built from Necrothing's keeper, with design tools drawn in the same low-poly style orbiting it. */
const stage = document.querySelector('[data-head-stage]');
const T = window.THREE;
if (stage && T && T.GLTFLoader) {
  try {
    const canvas = stage.querySelector('[data-head-canvas]');
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, .1, 60);
    camera.position.set(0, .2, 9);
    scene.add(new T.HemisphereLight(0xfff3e2, 0x6b5a4a, 1.4));
    const key = new T.DirectionalLight(0xffffff, 2.4); key.position.set(-3, 4, 5); scene.add(key);
    const rim = new T.DirectionalLight(0xffb48a, 1.4); rim.position.set(4, 1, -3); scene.add(rim);

    const rig = new T.Group(); scene.add(rig);
    const headPivot = new T.Group(); rig.add(headPivot);

    // the head: the Necrothing keeper styled as me, if the model is there; a simple placeholder otherwise
    const loadHead = () => new Promise(res => {
      const b64 = window.FM_HEAD;
      if (!b64) return res(null);
      const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
      new T.GLTFLoader().parse(buf, '', g => res(g.scene), () => res(null));
    });
    loadHead().then(head => {
      if (!head) {
        const g = new T.IcosahedronGeometry(1, 1);
        head = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0xf1c9a8, flatShading: true, roughness: .8 }));
      }
      const box = new T.Box3().setFromObject(head), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
      const s = 2.55 / Math.max(size.x, size.y, size.z);
      head.position.sub(c.multiplyScalar(s)); head.scale.setScalar(s);
      headPivot.add(head);
      stage.classList.add('is-ready');
    });

    // low-poly props in Necrothing's spirit: flat shading, bevels, a small palette, real detail
    const M = (color, extra = {}) => new T.MeshStandardMaterial({ color, flatShading: true, roughness: .7, ...extra });
    const glow = color => new T.MeshBasicMaterial({ color });
    const box = (w, h, d, m) => new T.Mesh(new T.BoxGeometry(w, h, d), m);
    const rounded = (w, h, r, depth, m, bevel = .02) => {
      const sh = new T.Shape(), x = -w / 2, y = -h / 2;
      sh.moveTo(x + r, y); sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r); sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r); sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
      const g = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 3 });
      g.translate(0, 0, -depth / 2); return new T.Mesh(g, m);
    };
    const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
    const props = [];
    const prop = (obj, orbit) => { const g = new T.Group(); g.add(obj); rig.add(g); props.push({ g, obj, ...orbit }); return g; };

    // smartphone: rounded body, bezel, camera island, an app on screen
    const phone = new T.Group();
    phone.add(rounded(.6, 1.2, .1, .05, M(0x23302c), .02));
    phone.add(at(rounded(.52, 1.1, .07, .005, glow(0x18231f), .005), 0, 0, .04));
    phone.add(at(box(.16, .035, .01, glow(0x0b0f0e)), 0, .51, .05));
    phone.add(at(rounded(.46, .26, .04, .005, glow(0xc2411d), .003), 0, .32, .05));
    [[.1, 0xf3ecdc, .36], [-.04, 0xf3ecdc, .28], [-.18, 0x6fd3bd, .32], [-.32, 0xf3ecdc, .22]].forEach(([y, c, w]) => phone.add(at(box(w, .05, .006, glow(c)), -.2 + w / 2, y, .052)));
    phone.add(at(new T.Mesh(new T.CircleGeometry(.05, 12), glow(0x6fd3bd)), .14, -.42, .053));
    const cam = rounded(.18, .18, .05, .03, M(0x1a2421), .01); cam.position.set(-.16, .44, -.04); phone.add(cam);
    prop(phone, { r: 1.75, speed: .2, phase: .3, y: .95, tilt: .35, spin: .4, s: .62 });

    // laptop: keyboard, trackpad, hinge, a dashboard on screen
    const laptop = new T.Group();
    laptop.add(rounded(1.5, 1, .06, .05, M(0xc2c5c8), .015)); laptop.children[0].rotation.x = -Math.PI / 2;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 11; c++) laptop.add(at(box(.1, .015, .07, M(0x2d3134)), -.58 + c * .116, .04, -.32 + r * .1));
    laptop.add(at(box(.44, .01, .26, M(0xb3b6b9)), 0, .036, .24));
    const lid = new T.Group(); lid.position.set(0, .03, -.5); laptop.add(lid);
    const shell = rounded(1.5, 1, .06, .04, M(0xd0d3d6), .015); shell.position.y = .5; lid.add(shell);
    lid.add(at(box(1.38, .86, .005, glow(0x101614)), 0, .5, .03));
    lid.add(at(box(1.32, .8, .005, glow(0xf4f1ea)), 0, .5, .036));
    lid.add(at(box(.24, .8, .006, glow(0xe7e1d4)), -.54, .5, .04));
    [[.18, .74, .5, 0x141b17], [.18, .64, .34, 0xc2411d]].forEach(([x, y, w, c]) => lid.add(at(box(w, .06, .006, glow(c)), -.38 + x + w / 2, y, .042)));
    for (let i = 0; i < 6; i++) lid.add(at(box(.06, .08 + (i * 37 % 5) * .05, .006, glow(i % 2 ? 0x2343d6 : 0x6fd3bd)), -.06 + i * .09, .3, .042));
    lid.rotation.x = -.32;
    prop(laptop, { r: 1.95, speed: .2, phase: 2.4, y: -1.05, tilt: .22, spin: .22, s: .58 });

    // pencil: hexagonal, stripes, metal ferrule, eraser
    const pencil = new T.Group();
    pencil.add(new T.Mesh(new T.CylinderGeometry(.07, .07, 1.2, 6), M(0xf2b544)));
    [-.3, .1].forEach(y => pencil.add(at(new T.Mesh(new T.CylinderGeometry(.072, .072, .03, 6), M(0x141b17)), 0, y, 0)));
    pencil.add(at(new T.Mesh(new T.CylinderGeometry(.075, .075, .14, 6), M(0xbfc4c8, { metalness: .6, roughness: .35 })), 0, .66, 0));
    pencil.add(at(new T.Mesh(new T.CylinderGeometry(.07, .07, .14, 6), M(0xe58a8a)), 0, .8, 0));
    const tip = new T.Mesh(new T.ConeGeometry(.07, .24, 6), M(0xe8c9a0)); tip.position.y = -.72; tip.rotation.x = Math.PI; pencil.add(tip);
    const lead = new T.Mesh(new T.ConeGeometry(.024, .08, 6), M(0x2a2a2a)); lead.position.y = -.81; lead.rotation.x = Math.PI; pencil.add(lead);
    pencil.rotation.z = .9;
    prop(pencil, { r: 1.55, speed: .28, phase: 4, y: -.25, tilt: .5, spin: 1, s: .7 });

    // post-its: slightly curled paper with handwriting
    const postit = c => {
      const g = new T.Group(), geo = new T.PlaneGeometry(.5, .5, 6, 6), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, y < -.1 ? (y + .1) * (y + .1) * 1.6 : 0); }
      geo.computeVertexNormals();
      g.add(new T.Mesh(geo, M(c, { side: T.DoubleSide })));
      [.12, .02, -.08].forEach((y, i) => g.add(at(box(.34 - i * .07, .02, .002, glow(0x2f3a5a)), -.04, y, .006)));
      return g;
    };
    [[0xf7d774, 1.2, .35], [0xf4a8b8, 3.6, -.55], [0x9fe0cf, 5.3, 1.25]].forEach(([c, ph, y]) => {
      const n = postit(c); n.rotation.set(.2, .3, .15);
      prop(n, { r: 1.6 + (ph % 1) * .4, speed: .17 + (ph % .1), phase: ph, y, tilt: .45, spin: .7, s: .7 });
    });

    // sheets: a user flow with rounded nodes, arrows and a decision diamond
    const sheet = seed => {
      const g = new T.Group();
      g.add(rounded(.9, 1.2, .02, .006, M(0xfbfaf6), .004));
      const nodes = seed ? [[-.22,.4],[.2,.4],[.2,.02],[-.22,-.38],[.2,-.38]] : [[0,.42],[-.24,.04],[.24,.04],[0,-.38]];
      nodes.forEach(([x,y], i) => {
        const diamond = !seed && i === 1;
        const m = diamond ? new T.Mesh(new T.PlaneGeometry(.17, .17), glow(0xf2b544)) : rounded(.24, .14, .03, .004, glow(i === 0 ? 0x141b17 : 0xffffff), .002);
        if (diamond) m.rotation.z = Math.PI / 4;
        m.position.set(x, y, .012); g.add(m);
        if (!diamond && i !== 0) g.add(at(rounded(.26, .16, .035, .002, glow(0x141b17), .001), x, y, .009));
      });
      const pts = []; for (let i = 0; i < nodes.length - 1; i++) pts.push(new T.Vector3(nodes[i][0], nodes[i][1], .016), new T.Vector3(nodes[i+1][0], nodes[i+1][1], .016));
      g.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0xc2411d })));
      return g;
    };
    prop(sheet(0), { r: 1.9, speed: .15, phase: 1.1, y: -.5, tilt: .28, spin: .35, s: .6 });
    prop(sheet(1), { r: 2.05, speed: .13, phase: 4.7, y: 1.05, tilt: .28, spin: .3, s: .55 });
    // smaller props, orbiting clear of the head (it is about 2.5 across)
    props.forEach(p => { p.s *= .62; p.obj.scale.setScalar(p.s); p.r = 2.05 + (p.r % .3); });

    let mx = 0, my = 0, tx = 0, ty = 0;
    addEventListener('pointermove', e => { tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });

    const resize = () => { const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.position.z = small ? 10 : 9.4; camera.updateProjectionMatrix(); };
    resize(); addEventListener('resize', resize);

    let raf = 0;
    const frame = t => {
      const s = t / 1000;
      mx += (tx - mx) * .05; my += (ty - my) * .05;
      // three-quarter view, following the pointer a little
      headPivot.rotation.y = .55 + mx * .35;
      headPivot.rotation.x = .05 + my * .18;
      headPivot.position.y = reduced ? 0 : Math.sin(s * 1.1) * .08;
      for (const p of props) {
        const a = p.phase + (reduced ? 0 : s * p.speed);
        p.g.position.set(Math.cos(a) * p.r * .78, p.y + Math.sin(a * 1.3 + p.phase) * .15, Math.sin(a) * p.r * .7);
        p.obj.rotation.y = (reduced ? 0 : s * p.spin * .4) + p.phase;
        p.obj.rotation.x = Math.sin(a) * p.tilt;
      }
      rig.rotation.x = .12;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    watch(stage, on => { if (on && !raf) raf = requestAnimationFrame(frame); if (!on) { cancelAnimationFrame(raf); raf = 0; } });
  } catch (e) { stage.classList.add('is-fallback'); }
} else if (stage) stage.classList.add('is-fallback');

})();
