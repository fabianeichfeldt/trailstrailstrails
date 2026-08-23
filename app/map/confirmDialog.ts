// Singleton confirm dialog, same pattern as lightbox.ts — a vanilla overlay
// appended to document.body, since this is used from vanilla-TS code
// (SpotPanel) that can't mount a Vue component inside the Leaflet panel.

let overlay: HTMLElement | null = null;
let resolvePromise: ((value: boolean) => void) | null = null;

function ensureOverlay(): HTMLElement {
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.className = 'confirm-dialog';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="confirm-dialog-backdrop"></div>
    <div class="confirm-dialog-card">
      <p class="confirm-dialog-message"></p>
      <div class="confirm-dialog-actions">
        <button class="confirm-dialog-cancel">Abbrechen</button>
        <button class="confirm-dialog-confirm">Löschen</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.confirm-dialog-backdrop')!.addEventListener('click', () => settle(false));
  overlay.querySelector('.confirm-dialog-cancel')!.addEventListener('click', () => settle(false));
  overlay.querySelector('.confirm-dialog-confirm')!.addEventListener('click', () => settle(true));

  document.addEventListener('keydown', e => {
    if (!overlay?.classList.contains('confirm-dialog--open')) return;
    if (e.key === 'Escape') settle(false);
  });

  return overlay;
}

function settle(value: boolean) {
  overlay?.classList.remove('confirm-dialog--open');
  document.body.style.overflow = '';
  resolvePromise?.(value);
  resolvePromise = null;
}

/** Shows a Ja/Nein confirmation overlay; resolves true on confirm, false on cancel/backdrop/Escape. */
export function confirmDialog(message: string, confirmLabel = 'Löschen'): Promise<boolean> {
  const dlg = ensureOverlay();
  dlg.querySelector('.confirm-dialog-message')!.textContent = message;
  (dlg.querySelector('.confirm-dialog-confirm') as HTMLElement).textContent = confirmLabel;
  dlg.classList.add('confirm-dialog--open');
  document.body.style.overflow = 'hidden';

  return new Promise<boolean>(resolve => {
    resolvePromise = resolve;
  });
}
