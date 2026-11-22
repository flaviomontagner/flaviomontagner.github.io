const boards = [...document.querySelectorAll('[data-board]')];
if (boards.length) {
  const overlay = document.createElement('dialog');
  overlay.className = 'board-dialog';
  overlay.setAttribute('aria-label', 'Expanded platform board');
  document.body.append(overlay);

  let expanded, opener, placeholder;
  overlay.addEventListener('close', () => {
    if (!expanded) return;
    placeholder.replaceWith(expanded);
    opener.focus({ preventScroll:true });
    opener.textContent = 'Open wide ↗';
    expanded = undefined;
  });

  for (const board of boards) {
    const controls = board.querySelector('.board-controls');
    const viewport = board.querySelector('.board-window');
    const canvas = board.querySelector('[data-board-canvas]');
    const output = controls.querySelector('output');
    const isMatrix = canvas.classList.contains('service-canvas');
    let scale = 1;

    function zoomTo(next) {
      const x = (viewport.scrollLeft + viewport.clientWidth / 2) / scale;
      const y = (viewport.scrollTop + viewport.clientHeight / 2) / scale;
      scale = Math.max(0.2, Math.min(1.6, next));
      canvas.style.zoom = scale;
      output.value = Math.round(scale * 100) + '%';
      viewport.scrollTo(Math.max(0,x * scale - viewport.clientWidth / 2),
        Math.max(0,y * scale - viewport.clientHeight / 2));
    }

    function fit(minimum = 0.2) {
      zoomTo(Math.max(minimum,Math.min(1,viewport.clientWidth / canvas.offsetWidth)));
      viewport.scrollTo(0,0);
    }

    controls.hidden = false;
    if (isMatrix) zoomTo(0.8);
    else if (viewport.clientWidth > 600) fit();
    else zoomTo(0.72);
    controls.addEventListener('click', event => {
      const action = event.target.closest('[data-board-action]')?.dataset.boardAction;
      if (action === 'in') zoomTo(scale + 0.15);
      if (action === 'out') zoomTo(scale - 0.15);
      if (action === 'fit') fit();
      if (action !== 'open') return;
      if (overlay.open) {
        overlay.close();
        return;
      }
      opener = event.target.closest('button');
      expanded = board;
      placeholder = document.createComment('Board location');
      board.replaceWith(placeholder);
      overlay.append(board);
      overlay.showModal();
      opener.textContent = 'Close wide view';
      opener.focus();
      fit(isMatrix ? 0.82 : 0.58);
    });

    function moveTo(target) {
      if (scale < 0.5) zoomTo(0.55);
      const frame = viewport.getBoundingClientRect();
      const node = target.getBoundingClientRect();
      viewport.scrollTo(viewport.scrollLeft + node.left - frame.left - 18,
        viewport.scrollTop + node.top - frame.top - 18);
      target.tabIndex = -1;
      target.focus({ preventScroll:true });
      if (!overlay.open) board.scrollIntoView({ block:'nearest' });
    }
    board.addEventListener('beta:locate', event => moveTo(event.detail));
  }

  function navigate(target) {
    const destination = target.closest('[data-board]');
    const locate = () => destination.dispatchEvent(new CustomEvent('beta:locate',{ detail:target }));
    if (overlay.open && destination !== expanded) {
      overlay.addEventListener('close', locate, { once:true });
      overlay.close();
    } else locate();
  }
  for (const link of document.querySelectorAll('[data-board] a[href^="#"]')) {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      if (target.matches('.service-stage-notes details')) {
        event.preventDefault();
        const reveal = () => {
          target.open = true;
          history.pushState(null,'',link.hash);
          target.scrollIntoView({block:'start'});
          target.querySelector('summary').focus({preventScroll:true});
        };
        if (overlay.open) {
          overlay.addEventListener('close',reveal,{once:true});
          overlay.close();
        } else reveal();
        return;
      }
      if (!target.closest('[data-board]')) return;
      event.preventDefault();
      history.pushState(null,'',link.hash);
      navigate(target);
    });
  }
  function locateHash() {
    const target = document.getElementById(location.hash.slice(1));
    if (target?.closest('[data-board]')) navigate(target);
  }
  addEventListener('hashchange',locateHash);
  locateHash();
}
