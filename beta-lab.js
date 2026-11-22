(() => {
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* Menu */
const menu = document.getElementById('lab-menu');
const menuButton = document.querySelector('[data-menu-open]');
if (typeof menu.showModal === 'function') {
  menuButton.hidden = false;
  menuButton.addEventListener('click', () => {
    menu.showModal();
    menuButton.setAttribute('aria-expanded','true');
  });
  menu.addEventListener('close', () => menuButton.setAttribute('aria-expanded','false'));
  menu.querySelector('[data-menu-close]').addEventListener('click', () => menu.close());
  menu.addEventListener('click', event => {
    if (event.target.closest('a') || event.target === menu) menu.close();
  });
  matchMedia('(max-width:1020px)').addEventListener('change', event => {
    if (!event.matches && menu.open) menu.close();
  });
}

/* Tabs (the stage explorer) */
for (const widget of document.querySelectorAll('[data-lab-tabs]')) {
  const tabList = widget.querySelector('[data-tab-list]');
  const tabs = [...tabList.querySelectorAll('[data-lab-tab]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  let active = -1;
  const select = (index, focus = false) => {
    if (index === active) return;
    tabs.forEach((tab, i) => {
      tab.tabIndex = i === index ? 0 : -1;
      tab.setAttribute('aria-selected', String(i === index));
      panels[i].hidden = i !== index;
    });
    if (focus) tabs[index].focus();
    if (active >= 0 && !reducedMotion.matches) {
      panels[index].animate([{opacity:.4,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:260,easing:'ease-out'});
    }
    active = index;
    widget.dispatchEvent(new CustomEvent('lab:select', {detail:index}));
  };
  tabList.setAttribute('role','tablist');
  tabs.forEach((tab, i) => {
    tab.setAttribute('role','tab');
    panels[i].setAttribute('role','tabpanel');
    panels[i].setAttribute('aria-labelledby', tab.id);
    panels[i].tabIndex = 0;
    tab.addEventListener('click', () => select(i));
  });
  tabList.addEventListener('keydown', event => {
    const last = tabs.length - 1;
    const target = {ArrowLeft:active === 0 ? last : active - 1, ArrowRight:active === last ? 0 : active + 1, Home:0, End:last}[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target, true);
  });
  widget.dataset.ready = '';
  select(0);
}

/* The journey map: the selected step lights its column; any cell selects its step. */
for (const map of document.querySelectorAll('.lab-journey')) {
  const cells = [...map.querySelectorAll('.lab-jcell')];
  const grid = map.querySelector('.lab-jmap');
  map.addEventListener('lab:select', event => {
    grid.classList.add('has-active');
    cells.forEach(cell => cell.classList.toggle('is-active', +cell.dataset.col === event.detail));
  });
  grid.classList.remove('has-active');
  cells.forEach(cell => cell.classList.remove('is-active'));
  grid.addEventListener('click', event => {
    const cell = event.target.closest('.lab-jcell[data-col]');
    if (cell) map.querySelectorAll('[data-lab-tab]')[+cell.dataset.col]?.click();
  });
}

/* Diagrams keep their original coordinates and scale to the column (never below 62%, then they scroll). */
const canvases = [...document.querySelectorAll('[data-canvas]')];
function fitCanvases() {
  for (const el of canvases) {
    const w = +el.dataset.w, h = +el.dataset.h;
    const s = Math.max(.62, Math.min(1, el.clientWidth / w));
    el.style.setProperty('--w', w);
    el.style.setProperty('--h', h);
    el.style.setProperty('--s', s.toFixed(4));
  }
}
fitCanvases();
addEventListener('resize', fitCanvases);

/* Map and screens point at each other: arriving at either marks it for a moment. */
function flash(id) {
  const target = id && /^(screen|map)-/.test(id) ? document.getElementById(id) : null;
  if (!target) return;
  target.classList.remove('is-flash');
  void target.offsetWidth;
  target.classList.add('is-flash');
  setTimeout(() => target.classList.remove('is-flash'), 1800);
  const box = target.closest('[data-canvas]');
  if (box) {
    const r = target.getBoundingClientRect(), b = box.getBoundingClientRect();
    box.scrollLeft += (r.left + r.width / 2) - (b.left + b.width / 2);
  }
}
addEventListener('hashchange', () => flash(location.hash.slice(1)));
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#screen-"], a[href^="#map-"]');
  if (link) setTimeout(() => flash(link.hash.slice(1)), 30);
});

/* Hovering a page in the map previews its screen. */
if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
  const peek = document.createElement('figure');
  peek.className = 'lab-peek';
  peek.setAttribute('aria-hidden','true');
  peek.innerHTML = '<img alt=""><p></p>';
  document.body.append(peek);
  const img = peek.querySelector('img');
  document.addEventListener('pointerover', event => {
    const node = event.target.closest('[data-peek]');
    if (!node) return;
    img.src = node.dataset.peek;
    peek.querySelector('p').textContent = node.dataset.peekLabel || '';
    const r = node.getBoundingClientRect();
    const tall = 'peekTall' in node.dataset;
    peek.classList.toggle('is-tall', tall);
    if (tall) {
      // phone screens: beside the node, vertically centred in the viewport
      const w = 266, h = 590;
      const right = r.right + 16 + w < innerWidth;
      peek.style.left = (right ? r.right + 16 : Math.max(16, r.left - 16 - w)) + 'px';
      peek.style.top = Math.min(innerHeight - h - 12, Math.max(70, r.top + r.height / 2 - h / 2)) + 'px';
    } else {
      const left = Math.min(innerWidth - 436, Math.max(16, r.left + r.width / 2 - 210));
      const below = r.bottom + 300 < innerHeight;
      peek.style.left = left + 'px';
      peek.style.top = (below ? r.bottom + 12 : r.top - 12 - 286) + 'px';
    }
    peek.classList.add('is-on');
  });
  document.addEventListener('pointerout', event => {
    if (event.target.closest('[data-peek]') && !event.relatedTarget?.closest?.('[data-peek]')) peek.classList.remove('is-on');
  });
  addEventListener('scroll', () => peek.classList.remove('is-on'), {passive:true});
}

/* The routes spine stops at the middle of the last route. */
const routes = document.querySelector('.lab-routes');
function fitSpine() {
  const last = routes?.querySelector('li:last-child');
  if (!last) return;
  const pill = routes.querySelector('.lab-routes-in span');
  if (pill) routes.style.setProperty('--spine', `${Math.round(pill.offsetWidth / 2)}px`);
  const tick = parseFloat(getComputedStyle(last, '::before').top) || last.offsetHeight / 2;
  routes.style.setProperty('--last', `${last.offsetHeight - tick - 2}px`);
}
fitSpine();
document.fonts?.ready.then(fitSpine);
addEventListener('resize', fitSpine);

/* Annotated screens: a note lights its pin. */
for (const spec of document.querySelectorAll('.lab-spec')) {
  const pins = [...spec.querySelectorAll('.lab-pin')];
  spec.querySelectorAll('[data-pin]').forEach((note, i) => {
    const on = state => { pins[i]?.classList.toggle('is-hot', state); note.classList.toggle('is-hot', state); };
    note.addEventListener('pointerenter', () => on(true));
    note.addEventListener('pointerleave', () => on(false));
  });
}

/* The clock: 10:00 runs down to <2:00 while the hero is pinned. */
const clock = document.querySelector('[data-clock]');
const clockValue = clock?.querySelector('[data-clock-value]');
let clockFrame = 0;
function format(seconds) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2,'0')}`;
}
function runClock() {
  clockFrame = 0;
  const box = clock.getBoundingClientRect();
  const travel = Math.max(1, box.height - innerHeight);
  const progress = clamp(-box.top / travel);
  const t = clamp((progress - .1) / .6);
  const eased = 1 - Math.pow(1 - t, 2.2);
  const done = t >= 1;
  clock.classList.toggle('is-done', done);
  clock.style.setProperty('--clock', progress.toFixed(3));
  clockValue.textContent = done ? '<2:00' : format(600 - eased * 480);
}
if (clock && !reducedMotion.matches) {
  clock.classList.add('is-live');
  clockValue.setAttribute('aria-hidden','true');
  const spoken = document.createElement('span');
  spoken.className = 'visually-hidden';
  spoken.textContent = '10 minutes before, under 2 minutes with Beta Platform.';
  clockValue.after(spoken);
  runClock();
  addEventListener('scroll', () => { if (!clockFrame) clockFrame = requestAnimationFrame(runClock); }, {passive:true});
  addEventListener('resize', () => { if (!clockFrame) clockFrame = requestAnimationFrame(runClock); });
}

/* Navigation state and reading progress */
const samePage = l => l.hash && l.pathname === location.pathname && document.getElementById(l.hash.slice(1));
const navLinks = [...document.querySelectorAll('.lab-nav .lab-nav-link, .lab-rail .lab-nav-link, .lab-menu-inner .lab-nav-link')].filter(samePage);
const navSections = [...new Set(navLinks.map(link => link.hash))].map(hash => document.getElementById(hash.slice(1))).filter(Boolean);
const progressBar = document.querySelector('.lab-progress');
let scrollFrame = 0;
function updateNav() {
  const current = navSections.findLast(section => section.getBoundingClientRect().top < innerHeight * .4);
  for (const link of navLinks) {
    if (current && link.hash === '#' + current.id) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  }
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  progressBar.style.setProperty('--lab-progress', maxScroll > 0 ? Math.max(.01, scrollY / maxScroll) : 1);
  scrollFrame = 0;
}
const scheduleNavigation = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateNav); };
addEventListener('scroll', scheduleNavigation, {passive:true});
const topButton = document.querySelector('[data-top]');
if (topButton) {
  const toggleTop = () => topButton.classList.toggle('is-on', scrollY > 600);
  addEventListener('scroll', toggleTop, {passive:true}); toggleTop();
  topButton.addEventListener('click', e => { e.preventDefault(); scrollTo({top:0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); });
}
addEventListener('resize', scheduleNavigation);
updateNav();

/* Results draw themselves once, as they reach the middle of the screen. */
const strikes = [...document.querySelectorAll('[data-strike]')];
if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  strikes.forEach(item => item.classList.add('is-waiting'));
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const item = entry.target;
      setTimeout(() => item.classList.remove('is-waiting'), strikes.indexOf(item) * 200);
      item.querySelectorAll('.lab-grid i.on').forEach((cell, i) => { cell.style.transitionDelay = `${i * 12}ms`; });
      observer.unobserve(item);
    }
  }, {rootMargin:'0px 0px -30% 0px'});
  strikes.forEach(item => observer.observe(item));
}

/* Diagrams: focusing a node keeps only its own connections lit. */
for (const g of document.querySelectorAll('[data-canvas]')) {
  const edges = [...g.querySelectorAll('.sg-edge, .graph-edge')];
  const nodes = [...g.querySelectorAll('[data-node]')];
  if (!edges.length || !nodes.length) continue;
  const focus = id => {
    const linked = new Set([id]);
    edges.forEach(e => { const on = e.dataset.from === id || e.dataset.to === id; e.classList.toggle('is-on', on); if (on) { linked.add(e.dataset.from); linked.add(e.dataset.to); } });
    nodes.forEach(n => n.classList.toggle('is-on', linked.has(n.dataset.node)));
    g.classList.add('is-focus');
  };
  const clear = () => { g.classList.remove('is-focus'); edges.forEach(e => e.classList.remove('is-on')); nodes.forEach(n => n.classList.remove('is-on')); };
  g.addEventListener('pointerover', e => { const n = e.target.closest('[data-node]'); if (n) focus(n.dataset.node); });
  g.addEventListener('pointerleave', clear);
  g.addEventListener('focusin', e => { const n = e.target.closest('[data-node]'); if (n) focus(n.dataset.node); });
  g.addEventListener('focusout', e => { if (!g.contains(e.relatedTarget)) clear(); });
}

/* Swipe hints: any visual that scrolls sideways gets a pill above it, removed at the first swipe. */
{
  const touch = matchMedia('(pointer: coarse)').matches;
  const label = touch ? 'Swipe to see more' : 'Scroll sideways to see more';
  const targets = [...document.querySelectorAll('.lab-jmap-scroll, .lab-canvas, .dz-score-scroll, .sl-strip, .nc-evo-row')];
  const hints = new Map();
  const sync = () => targets.forEach(el => {
    const wide = el.scrollWidth > el.clientWidth + 12 && el.clientWidth > 0;
    let hint = hints.get(el);
    if (wide && !hint && !el.dataset.swiped) {
      hint = document.createElement('p'); hint.className = 'lab-swipe'; hint.innerHTML = `${label} <i aria-hidden="true">→</i>`;
      el.before(hint); hints.set(el, hint);
      el.addEventListener('scroll', () => { el.dataset.swiped = '1'; hint.classList.add('is-gone'); setTimeout(() => hint.remove(), 400); hints.delete(el); }, { once: true, passive: true });
    } else if (!wide && hint) { hint.remove(); hints.delete(el); }
  });
  sync(); addEventListener('resize', sync); addEventListener('load', sync);
}

/* Work menu: on touch screens the first tap opens the list instead of leaving the page. */
for (const drop of document.querySelectorAll('.lab-drop')) {
  const link = drop.querySelector(':scope > .lab-nav-link');
  link.addEventListener('click', e => { if (matchMedia('(hover: none)').matches && !drop.classList.contains('is-open')) { e.preventDefault(); drop.classList.add('is-open'); } });
  document.addEventListener('click', e => { if (!drop.contains(e.target)) drop.classList.remove('is-open'); });
}
})();
