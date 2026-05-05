export function initDragHandle(panel: HTMLElement): void {
  const handle = panel.querySelector('.spot-panel-handle') as HTMLElement;
  let isResizing = false;
  let startPos = 0;
  let startSize = 0;
  let isHorizontal = false;

  const isDesktopMode = () => window.innerWidth >= 768;

  const updateHandlePosition = () => {
    if (isDesktopMode()) {
      const rect = panel.getBoundingClientRect();
      handle.style.left = (rect.left - 4) + 'px';
      handle.style.display = 'block';
    } else {
      handle.style.display = '';
      handle.style.left = '';
    }
  };

  const startResize = (clientX: number, clientY: number) => {
    isResizing = true;
    isHorizontal = isDesktopMode();
    if (isHorizontal) {
      startPos = clientX;
      startSize = panel.getBoundingClientRect().width;
    } else {
      startPos = clientY;
      startSize = panel.getBoundingClientRect().height;
    }
    panel.style.transition = 'none';
    panel.style.userSelect = 'none';
  };

  const doResize = (clientX: number, clientY: number) => {
    if (!isResizing) return;
    if (isHorizontal) {
      const w = Math.max(280, Math.min(window.innerWidth * 0.6, startSize - (clientX - startPos)));
      panel.style.width = w + 'px';
      updateHandlePosition();
    } else {
      const h = Math.max(200, Math.min(window.innerHeight * 0.85, startSize + (startPos - clientY)));
      panel.style.height = h + 'px';
    }
  };

  const stopResize = () => {
    if (!isResizing) return;
    isResizing = false;
    panel.style.transition = '';
    panel.style.userSelect = '';
  };

  handle.addEventListener('touchstart', e => {
    startResize(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (isResizing && e.touches.length > 0) doResize(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  document.addEventListener('touchend', stopResize, { passive: true });

  handle.addEventListener('mousedown', e => startResize(e.clientX, e.clientY));
  document.addEventListener('mousemove', e => { if (isResizing) doResize(e.clientX, e.clientY); });
  document.addEventListener('mouseup', stopResize);

  updateHandlePosition();
  window.addEventListener('resize', updateHandlePosition);
}
