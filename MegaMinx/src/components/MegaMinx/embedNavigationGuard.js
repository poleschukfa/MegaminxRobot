/** Блокирует жесты/кнопки «назад» в iframe embed, чтобы не ломать симулятор. */
export function installEmbedNavigationGuard() {
  if (typeof window === 'undefined') return () => {};

  const cap = { capture: true, passive: false };

  const blockSideMouseButtons = (e) => {
    if (e.button === 3 || e.button === 4) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const blockAuxClick = (e) => {
    if (e.button !== 0) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  let rmbActive = false;
  let rmbStartX = 0;

  const onPointerDown = (e) => {
    blockSideMouseButtons(e);
    if (e.button === 2) {
      rmbActive = true;
      rmbStartX = e.clientX;
    }
  };

  const onPointerMove = (e) => {
    if (!rmbActive || !(e.buttons & 2)) return;
    if (Math.abs(e.clientX - rmbStartX) > 16) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onPointerUp = (e) => {
    if (e.button === 2) rmbActive = false;
    blockSideMouseButtons(e);
  };

  const onWheel = (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 4) {
      e.preventDefault();
    }
  };

  window.addEventListener('mousedown', blockSideMouseButtons, cap);
  window.addEventListener('mouseup', blockSideMouseButtons, cap);
  window.addEventListener('auxclick', blockAuxClick, cap);
  window.addEventListener('pointerdown', onPointerDown, cap);
  window.addEventListener('pointermove', onPointerMove, cap);
  window.addEventListener('pointerup', onPointerUp, cap);
  window.addEventListener('wheel', onWheel, cap);

  document.documentElement.classList.add('embed-mode');
  document.documentElement.style.overscrollBehaviorX = 'none';
  document.body.style.overscrollBehaviorX = 'none';

  return () => {
    window.removeEventListener('mousedown', blockSideMouseButtons, cap);
    window.removeEventListener('mouseup', blockSideMouseButtons, cap);
    window.removeEventListener('auxclick', blockAuxClick, cap);
    window.removeEventListener('pointerdown', onPointerDown, cap);
    window.removeEventListener('pointermove', onPointerMove, cap);
    window.removeEventListener('pointerup', onPointerUp, cap);
    window.removeEventListener('wheel', onWheel, cap);
    document.documentElement.classList.remove('embed-mode');
    document.documentElement.style.overscrollBehaviorX = '';
    document.body.style.overscrollBehaviorX = '';
  };
}
