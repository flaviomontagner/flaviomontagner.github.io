// The former research page contained both projects. Preserve old links to the game.
if (location.pathname.endsWith('/research.html') && location.hash === '#necrothing') {
  location.replace('necrothing.html');
}
const rail = document.querySelector('.rail');
if (rail) {
  const links = [...rail.querySelectorAll('a')];
  const chapters = links.map(link => document.getElementById(link.hash.slice(1)));
  let pending = false;
  function update() {
    const current = chapters.filter(section => section.getBoundingClientRect().top < innerHeight * 0.33).pop() || chapters[0];
    for (const link of links) {
      if (link.hash === '#' + current.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    pending = false;
  }
  function schedule() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(update);
    }
  }
  update();
  addEventListener('scroll', schedule, { passive:true });
  addEventListener('resize', schedule);
}
for (const link of document.querySelectorAll('.mobile-rail a')) {
  link.addEventListener('click', () => { link.closest('details').open = false; });
}
const viewer = document.getElementById('image-view');
if (viewer && typeof viewer.showModal === 'function') {
  const image = viewer.querySelector('img');
  const close = viewer.querySelector('[data-close]');
  let opener;
  for (const link of document.querySelectorAll('[data-zoom]')) {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      image.src = link.href;
      image.alt = link.querySelector('img')?.alt || link.dataset.label || '';
      viewer.querySelector('.image-label').textContent = image.alt;
      viewer.showModal();
      document.documentElement.classList.add('viewing-image');
      close.focus();
    });
  }
  close.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', e => { if (e.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => {
    document.documentElement.classList.remove('viewing-image');
    opener?.focus({ preventScroll:true });
  });
}

for (const viewer of document.querySelectorAll('[data-field-viewer]')) {
  const buttons = [...viewer.querySelectorAll('[data-field-button]')];
  const panels = [...viewer.querySelectorAll('[data-field-panel]')];
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const target = button.getAttribute('aria-controls');
      for (const panel of panels) panel.hidden = panel.id !== target;
      for (const control of buttons) control.setAttribute('aria-pressed', String(control === button));
    });
  }
  viewer.querySelector('.frame-switch').hidden = false;
}
