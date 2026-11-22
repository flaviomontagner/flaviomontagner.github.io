/* Taste Skill 2.5.1 · word-highlight and its required helpers. MIT, see taste-license.txt. */
(() => {
const rq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const reduced = () => !!(rq && rq.matches);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
function scrub(el, fn, { mode = 'hold', margin = '25% 0px' } = {}) {
  // on from the start, with the scroll listener: an observer that never reports (a dead stub, a page it cannot reach) leaves the
  // moment following the scroll instead of frozen at its first state; the observer turns it off when the target is far away
  let on = true, raf = 0, last = -1;
  const tick = () => {
    raf = 0;
    if (!on) return;
    const r = el.getBoundingClientRect(), vh = innerHeight;
    let p = mode === 'view' ? (vh - r.top) / (vh + r.height) : -r.top / Math.max(1, r.height - vh);
    p = clamp(p);
    if (p !== last) { last = p; fn(p, r); }
  };
  const req = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const io = new IntersectionObserver(es => {
    on = es[es.length - 1].isIntersecting;
    removeEventListener('scroll', req); removeEventListener('resize', req);
    if (on) { addEventListener('scroll', req, { passive: true }); addEventListener('resize', req); req(); }
  }, { rootMargin: margin });
  io.observe(el);
  addEventListener('scroll', req, { passive: true }); addEventListener('resize', req); req();
  return {
    update: () => { last = -1; req(); },
    destroy() { io.disconnect(); removeEventListener('scroll', req); removeEventListener('resize', req); if (raf) cancelAnimationFrame(raf); },
  };
}

function split(el, unit = 'words') {
  if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  const inners = [];
  const wrap = (text, cls) => {
    const s = document.createElement('span');
    s.className = cls;
    const i = document.createElement('span');
    i.className = 'mo-i';
    i.textContent = text;
    s.append(i);
    inners.push(i);
    return s;
  };
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          if (unit === 'chars') {
            const w = document.createElement('span');
            w.className = 'mo-w';
            for (const ch of part) w.append(wrap(ch, 'mo-c'));
            frag.append(w);
          } else frag.append(wrap(part, 'mo-w'));
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('mo-w')) {
        // a link or button inside keeps its name: its words are hidden with the rest, so it is named first
        if (n.matches('a[href], button') && !n.getAttribute('aria-label') && n.textContent.trim()) n.setAttribute('aria-label', n.textContent.replace(/\s+/g, ' ').trim());
        walk(n);
      }
    });
  };
  walk(el);
  el.querySelectorAll('.mo-w').forEach(w => w.setAttribute('aria-hidden', 'true'));
  return inners;
}


function mount(root, opts, lib) {
  const text = root.matches('p, h2, h3, blockquote') ? root : (root.querySelector('.mo-wh__text') || [...root.querySelectorAll('p, h2, h3, blockquote')].find(p => !p.matches('.t-label, .t-small, .muted')));
  if (!text) return {};
  root.classList.add('mo-wh');
  const words = lib.split(text, 'words').map(i => i.parentElement);
  if (lib.reduced()) { words.forEach(w => w.classList.add('is-on')); root.classList.add('is-done'); return {}; }
  const from = opts.from ?? 0.85, to = opts.to ?? 0.45;
  let n = -1;
  const s = lib.scrub(text, (p, r) => {
    const vh = innerHeight, start = vh * from, end = vh * to;
    const t = lib.clamp((start - r.top) / Math.max(1, (start - end) + r.height));
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;   // page bottom: it can climb no further, the statement stands in full ink
    const k = atEnd ? words.length : Math.round(t * words.length);
    if (k === n) return;
    n = k;
    words.forEach((w, i) => w.classList.toggle('is-on', i < k));
  }, { mode: 'view' });
  return { destroy: s.destroy };
}

// Served pages load the original ES modules. Local file previews use the bundled helpers above.
async function enhanceReading() {
  const statements = [...document.querySelectorAll('[data-moment="word-highlight"]')].map(el => {
    const text = el.matches('p') ? el : el.querySelector('.mo-wh__text');
    return { el, text, spoken: text.textContent };
  });
  if (reduced() || !statements.length) return;
  if (location.protocol === 'file:') {
    for (const {el} of statements) mount(el, {}, { clamp, split, reduced, scrub });
  } else {
    const moments = await import('./moments/moments.js');
    await moments.ready;
  }
  for (const {text, spoken} of statements) {
    if (!text.querySelector('.mo-w')) continue;
    const accessible = document.createElement('span');
    accessible.className = 'speak-only';
    accessible.textContent = spoken;
    text.removeAttribute('aria-label');
    text.append(accessible);
  }
}
enhanceReading().catch(() => { /* The original statement remains readable without animation. */ });
})();
