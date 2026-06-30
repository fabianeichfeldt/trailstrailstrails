import '../css/lightbox.css';

interface LightboxPhoto {
  src: string;
  uploader: string;
  date: string;
}

// ── Singleton state ──────────────────────────────────────────────────────────
let overlay: HTMLElement | null = null;
let photos: LightboxPhoto[] = [];
let index = 0;

// ── DOM bootstrap (once) ─────────────────────────────────────────────────────
function ensureOverlay(): HTMLElement {
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.className = 'lbx';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="lbx-backdrop"></div>
    <button class="lbx-close" aria-label="Schließen">✕</button>
    <button class="lbx-nav lbx-prev" aria-label="Vorheriges">‹</button>
    <div class="lbx-stage">
      <img class="lbx-img" alt="Trail-Foto" />
      <div class="lbx-meta">
        <span class="lbx-uploader"></span>
        <span class="lbx-date"></span>
      </div>
    </div>
    <button class="lbx-nav lbx-next" aria-label="Nächstes">›</button>
    <div class="lbx-counter"></div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.lbx-backdrop')!.addEventListener('click', close);
  overlay.querySelector('.lbx-close')!.addEventListener('click', close);
  overlay.querySelector('.lbx-prev')!.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
  overlay.querySelector('.lbx-next')!.addEventListener('click', (e) => { e.stopPropagation(); step(+1); });

  // Touch swipe
  let touchStartX = 0;
  overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  overlay.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
  });

  document.addEventListener('keydown', e => {
    if (!overlay?.classList.contains('lbx--open')) return;
    if (e.key === 'Escape')     close();
    if (e.key === 'ArrowLeft')  step(-1);
    if (e.key === 'ArrowRight') step(+1);
  });

  return overlay;
}

// ── Internal helpers ─────────────────────────────────────────────────────────
function render() {
  if (!overlay) return;
  const p = photos[index];
  (overlay.querySelector('.lbx-img') as HTMLImageElement).src = p.src;
  overlay.querySelector('.lbx-uploader')!.textContent = p.uploader ? `von ${p.uploader}` : '';
  overlay.querySelector('.lbx-date')!.textContent = p.date;
  overlay.querySelector('.lbx-counter')!.textContent =
    photos.length > 1 ? `${index + 1} / ${photos.length}` : '';
  const showNav = photos.length > 1;
  (overlay.querySelector('.lbx-prev') as HTMLElement).hidden = !showNav;
  (overlay.querySelector('.lbx-next') as HTMLElement).hidden = !showNav;
}

function step(dir: 1 | -1) {
  index = (index + dir + photos.length) % photos.length;
  render();
}

function close() {
  overlay?.classList.remove('lbx--open');
  document.body.style.overflow = '';
}

// ── Public API ───────────────────────────────────────────────────────────────
export function bindPhotoLightbox(container: HTMLElement) {
  const wraps = container.querySelectorAll<HTMLElement>('.photo-wrap');
  if (!wraps.length) return;

  const collected: LightboxPhoto[] = Array.from(wraps).map(wrap => ({
    src:      (wrap.querySelector('img') as HTMLImageElement)?.src ?? '',
    uploader: wrap.querySelector('.photo-uploader')?.textContent ?? '',
    date:     wrap.querySelector('.photo-date')?.textContent ?? '',
  }));

  wraps.forEach((wrap, i) => {
    wrap.style.cursor = 'zoom-in';
    wrap.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('.photo-fab, .photo-upload-btn')) return;
      photos = collected;
      index  = i;
      const lb = ensureOverlay();
      render();
      lb.classList.add('lbx--open');
      document.body.style.overflow = 'hidden';
    });
  });
}
