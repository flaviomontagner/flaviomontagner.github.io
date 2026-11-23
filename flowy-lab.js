(() => {
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Hero: an illustrative session plays on the phone while the log fills in. */
const capture = document.querySelector('[data-capture]');
if (capture) {
  const lines = [...capture.querySelectorAll('.fl-log li')];
  const strip = [...capture.querySelectorAll('.fl-strip i')];
  const screen = capture.querySelector('.fl-phone-screen');
  const tap = capture.querySelector('.fl-tap');
  const shutter = capture.querySelector('.fl-shutter');
  const pulse = el => { el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on'); };
  const tapOn = target => {
    const s = screen.getBoundingClientRect(), r = target.getBoundingClientRect();
    tap.style.setProperty('--tx', `${((r.left + r.width * .5) - s.left) / s.width * 100}%`);
    tap.style.setProperty('--ty', `${((r.top + r.height * .5) - s.top) / s.height * 100}%`);
    pulse(tap);
  };
  let slot = 0;
  const frame = kind => { if (strip[slot]) strip[slot++].classList.add(kind); };
  const steps = [
    () => { capture.dataset.state = 'vehicle'; frame('is-kept'); },
    () => tapOn(capture.querySelector('.is-vehicle .is-target')),
    () => { pulse(shutter); frame('is-kept'); frame('is-kept'); },
    () => { capture.dataset.state = 'plan'; frame('is-kept'); frame('is-kept'); },
    () => tapOn(capture.querySelector('.is-plan .fl-app-back')),
    () => { capture.dataset.state = 'settings'; frame('is-kept'); frame('is-kept'); },
    () => frame('is-dup'),
    () => { capture.classList.add('is-blurred'); pulse(shutter); frame('is-blur'); },
    () => { capture.dataset.state = 'plan'; frame('is-kept'); frame('is-kept'); frame('is-kept'); },
    () => frame('is-kept'),
  ];
  const reset = () => {
    lines.forEach(line => line.classList.remove('is-in','is-now'));
    strip.forEach(cell => cell.className = '');
    capture.classList.remove('is-blurred');
    capture.dataset.state = 'vehicle';
    slot = 0;
  };
  if (reduced) {
    capture.dataset.state = 'plan';
    strip.forEach((cell, i) => cell.classList.add(i === 6 ? 'is-dup' : 'is-kept'));
  } else {
    capture.classList.add('is-live');
    let i = 0, timer = 0, running = false;
    const next = () => {
      if (!running) return;
      if (i >= steps.length) { timer = setTimeout(() => { reset(); i = 0; next(); }, 2600); return; }
      lines.forEach(line => line.classList.remove('is-now'));
      lines[i].classList.add('is-in','is-now');
      steps[i]();
      i++;
      timer = setTimeout(next, i === 1 ? 900 : 1150);
    };
    reset();
    new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting;
      clearTimeout(timer);
      if (running) next();
    }, {threshold:.25}).observe(capture);
  }
}

/* One-shot reveals: the film strip of the old report and the capture timeline. */
const reveal = (el, onShow) => {
  if (!el) return;
  if (reduced || !('IntersectionObserver' in window)) { onShow?.(); return; }
  el.classList.add('is-waiting');
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    el.classList.remove('is-waiting');
    onShow?.();
    io.disconnect();
  }, {rootMargin:'0px 0px -25% 0px'});
  io.observe(el);
};
const film = document.querySelector('[data-film]');
if (film) {
  film.querySelectorAll('.fl-film-frames i').forEach((cell, i) => cell.style.setProperty('--i', i));
  reveal(film, () => setTimeout(() => film.classList.add('is-done'), reduced ? 0 : 1700));
}
reveal(document.querySelector('[data-timeline]'));

/* Analysis: the step in the middle of the screen picks the screenshot. */
const scrolly = document.querySelector('[data-scrolly]');
if (scrolly) {
  const steps = [...scrolly.querySelectorAll('[data-step]')];
  const shots = [...scrolly.querySelectorAll('[data-shot]')];
  const show = index => {
    steps.forEach((step, i) => step.classList.toggle('is-on', i === index));
    shots.forEach((shot, i) => shot.classList.toggle('is-on', i === index));
  };
  show(0);
  /* On phones a step lights up as soon as it is readable under the pinned shot, and stays lit until it slides beneath it. */
  const phone = matchMedia('(max-width:740px)');
  let io;
  const watch = () => {
    io?.disconnect();
    io = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) show(steps.indexOf(entry.target));
    }, {rootMargin: phone.matches ? '-70% 0px -29% 0px' : '-45% 0px -45% 0px'});
    steps.forEach(step => io.observe(step));
  };
  watch();
  phone.addEventListener('change', watch);
}
})();
