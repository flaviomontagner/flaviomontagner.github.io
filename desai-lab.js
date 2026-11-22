(() => {
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const watch = (el, cb, margin = '0px') => new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin: margin }).observe(el);
const once = (el, cb, margin = '0px 0px -25% 0px') => {
  if (!el) return;
  if (reduced || !('IntersectionObserver' in window)) { cb(); return; }
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { cb(); io.disconnect(); } }, { rootMargin: margin });
  io.observe(el);
};

/* Hero: AI proposes a batch of variants; the designer keeps a few and says why. */
const gen = document.querySelector('[data-gen]');
if (gen) {
  const grid = gen.querySelector('[data-gen-grid]');
  const counter = gen.querySelector('[data-gen-count]');
  const mobile = matchMedia('(max-width:740px)').matches;
  const n = mobile ? 9 : 12;
  const rejectWhy = ['Generic dashboard', 'Answers the wrong task', 'Fails contrast', 'Breaks the design system', 'Same idea, new colour', 'No evidence for this', 'Hides the key action', 'Too many decisions at once'];
  const keepWhy = ['Fits the observed task', 'Decision happens earlier', 'Evidence beside the action'];
  let proposed = 0, kept = 0, timer = 0, running = false;
  const count = () => { counter.textContent = `${proposed} proposed · ${kept} kept`; };
  const layouts = [
    ['k','a','',''], ['','k','k',''], ['a','','',''], ['k','','a',''], ['','','k','a'], ['a','a','',''],
  ];
  const variant = i => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dz-var';
    const l = layouts[(i + Math.floor(Math.random() * 6)) % 6];
    const rows = 2 + Math.floor(Math.random() * 3);
    btn.style.setProperty('--r', rows);
    btn.innerHTML = `<span class="bar"></span><span class="body" style="grid-template-columns:${Math.random() > .5 ? '1fr 2fr' : '2fr 1fr'};grid-template-rows:repeat(${rows},1fr)">${Array.from({ length: rows * 2 }, (_, j) => `<i class="${l[j % 4]}"></i>`).join('')}</span><span class="why"></span>`;
    btn.setAttribute('aria-label', `Variant ${i + 1}`);
    btn.addEventListener('click', () => decide(btn, !btn.classList.contains('is-kept')));
    return btn;
  };
  const decide = (btn, keep, why) => {
    const was = btn.classList.contains('is-kept');
    btn.classList.toggle('is-kept', keep);
    btn.classList.toggle('is-rejected', !keep);
    btn.querySelector('.why').textContent = why || (keep ? keepWhy[Math.floor(Math.random() * keepWhy.length)] : rejectWhy[Math.floor(Math.random() * rejectWhy.length)]);
    btn.setAttribute('aria-pressed', String(keep));
    kept += (keep ? 1 : 0) - (was ? 1 : 0);
    count();
  };
  const batch = () => {
    grid.textContent = '';
    const cards = Array.from({ length: n }, (_, i) => grid.appendChild(variant(i)));
    cards.forEach((c, i) => setTimeout(() => { c.classList.add('is-in'); proposed++; count(); }, reduced ? 0 : 90 * i));
    const keepIdx = new Set([Math.floor(Math.random() * n)]);
    if (Math.random() > .5) keepIdx.add(Math.floor(Math.random() * n));
    const order = cards.map((c, i) => i).sort(() => Math.random() - .5);
    order.forEach((i, k) => setTimeout(() => {
      if (!cards[i].classList.contains('is-kept') && !cards[i].classList.contains('is-rejected')) decide(cards[i], keepIdx.has(i), keepIdx.has(i) ? keepWhy[k % keepWhy.length] : rejectWhy[k % rejectWhy.length]);
    }, reduced ? 0 : 90 * n + 600 + 260 * k));
    if (!reduced) timer = setTimeout(() => running && batch(), 90 * n + 600 + 260 * n + 3800);
  };
  if (reduced) batch();
  else watch(gen, on => { if (on && !running) { running = true; batch(); } if (!on) { running = false; clearTimeout(timer); } });
}

/* Shift: the DesAI row settles into its proportions when it comes into view. */
const bars = document.querySelector('[data-bars]');
if (bars && !reduced) { bars.classList.add('is-waiting'); once(bars, () => bars.classList.remove('is-waiting')); }

/* Loop: a stream of proposals; each gate lets fewer through. */
const pipe = document.querySelector('[data-pipe]');
if (pipe) {
  const cv = pipe.querySelector('canvas'), ctx = cv.getContext('2d');
  const gates = [.14, .36, .58, .80];
  const keep = [.6, .55, .55, .7];
  let dots = [], raf = 0, last = 0, spawn = 0, W = 0, H = 0;
  const size = () => { const r = pipe.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#9a5c00';
  const add = () => dots.push({ x: -6, y: 34 + Math.random() * (H - 60), v: 190 + Math.random() * 90, gate: 0, alive: true, fade: 1 });
  const frame = t => {
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    spawn -= dt; if (spawn <= 0) { add(); spawn = .05; }
    ctx.clearRect(0, 0, W, H);
    for (const d of dots) {
      d.x += d.v * dt;
      if (d.alive && d.gate < gates.length && d.x > gates[d.gate] * W) { if (Math.random() > keep[d.gate]) d.alive = false; d.gate++; }
      if (!d.alive) { d.fade -= dt * 2.5; d.y += 30 * dt; }
      const passed = d.alive && d.gate === gates.length;
      ctx.globalAlpha = Math.max(0, d.fade);
      ctx.fillStyle = passed ? accent : (d.alive ? '#141b17' : '#a29a89');
      ctx.beginPath(); ctx.arc(d.x, d.y, passed ? 5 : 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    dots = dots.filter(d => d.fade > 0 && d.x < W + 10);
    raf = requestAnimationFrame(frame);
  };
  size(); addEventListener('resize', size);
  if (reduced) { for (let i = 0; i < 60; i++) { add(); dots[i].x = Math.random() * W; } frame(performance.now()); cancelAnimationFrame(raf); }
  else watch(pipe, on => { if (on && !raf) { last = 0; raf = requestAnimationFrame(frame); } if (!on) { cancelAnimationFrame(raf); raf = 0; } });
}

/* Phases: hovering a phase highlights its column in both lanes. */
const score = document.querySelector('[data-score]');
if (score) {
  const items = [...score.querySelectorAll('[data-col]')];
  score.addEventListener('pointerover', e => {
    const c = e.target.closest('[data-col]'); if (!c) return;
    score.classList.add('has-focus');
    items.forEach(it => it.classList.toggle('is-on', it.dataset.col === c.dataset.col));
  });
  score.addEventListener('pointerleave', () => { score.classList.remove('has-focus'); items.forEach(it => it.classList.remove('is-on')); });
}

/* Delivery: bolts fill the same days as one sprint; the ticket moves with git events. */
const cal = document.querySelector('[data-cal]');
if (cal && !reduced) { cal.classList.add('is-waiting'); once(cal, () => cal.classList.remove('is-waiting')); }
const sync = document.querySelector('[data-sync]');
if (sync) {
  const ticket = sync.querySelector('[data-ticket]'), label = sync.querySelector('[data-sync-event]');
  const steps = [
    [0, 'Ticket in the backlog'], [1, 'git checkout -b feature/group-reports'], [2, 'Pull request opened'],
    [2, 'CI running…'], [3, 'CI passed → Ready for QA'], [4, 'Merged → Done'],
  ];
  let i = 0, timer = 0;
  const show = k => { const [col, text] = steps[k]; ticket.parentElement.style.setProperty('--col', col); label.textContent = text; };
  const next = () => { show(i); i = (i + 1) % steps.length; timer = setTimeout(next, i === 0 ? 2600 : 1500); };
  if (reduced) show(steps.length - 1);
  else watch(sync, on => { clearTimeout(timer); if (on) next(); });
}

/* Guardrails: each bolt in turn reads the brief, checks the change and records the trade-offs. */
const vision = document.querySelector('[data-vision]');
if (vision && !reduced) {
  const bolts = [...vision.querySelectorAll('.dz-bolts li')];
  let k = 0, timer = 0;
  const step = () => { bolts.forEach((b, j) => b.classList.toggle('is-on', j === k)); k = (k + 1) % bolts.length; timer = setTimeout(step, 1400); };
  watch(vision, on => { clearTimeout(timer); if (on) step(); });
}

/* Reins: direction travels out to the agents; proposals travel back to the centre. */
const conductor = document.querySelector('[data-conductor]');
if (conductor && !reduced) {
  const ends = [[200,60],[340,200],[200,340],[60,200]];
  const outs = [...conductor.querySelectorAll('[data-pulse]')], ins = [...conductor.querySelectorAll('[data-pulse-in]')];
  let raf = 0, t0 = 0;
  const frame = t => {
    if (!t0) t0 = t;
    const s = (t - t0) / 1000;
    ends.forEach(([x, y], i) => {
      const p = ((s * .45) + i * .25) % 1, q = ((s * .45) + i * .25 + .5) % 1;
      outs[i].setAttribute('cx', 200 + (x - 200) * p); outs[i].setAttribute('cy', 200 + (y - 200) * p);
      ins[i].setAttribute('cx', x + (200 - x) * q); ins[i].setAttribute('cy', y + (200 - y) * q);
      ins[i].style.opacity = q > .8 ? (1 - q) * 5 : 1;
    });
    raf = requestAnimationFrame(frame);
  };
  watch(conductor, on => { if (on && !raf) raf = requestAnimationFrame(frame); if (!on) { cancelAnimationFrame(raf); raf = 0; } });
}
})();
