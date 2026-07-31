// Minimal bottom slide-up sheet for the trail-status badge's explanation
// text on mobile. Visually consistent with the app's existing bottom-sheet
// pattern (.spot-panel: fixed to viewport bottom, rounded top corners,
// slide-up transform, drag-handle-style bar — see src/assets/css/marker.css
// and src/assets/css/spot_panel.css) without pulling in the full SpotPanel,
// which is a much larger, unrelated concern (tabs, GPX list, elevation...).
//
// Pure DOM — no Leaflet dependency, so it can be created once and reused
// across every badge tap.

export interface TrailStatusSheet {
  open(text: string): void
  close(): void
  readonly isOpen: boolean
}

export function createTrailStatusSheet(): TrailStatusSheet {
  let sheet = document.querySelector('.trail-status-sheet') as HTMLElement | null

  if (!sheet) {
    sheet = document.createElement('div')
    sheet.className = 'trail-status-sheet'
    sheet.innerHTML = `
      <div class="trail-status-sheet-handle"></div>
      <p class="trail-status-sheet-text"></p>
    `
    document.body.appendChild(sheet)
  }

  const sheetEl = sheet
  const textEl  = sheetEl.querySelector('.trail-status-sheet-text') as HTMLElement
  const handle  = sheetEl.querySelector('.trail-status-sheet-handle') as HTMLElement

  let open_ = false

  function open(text: string) {
    textEl.textContent = text
    sheetEl.classList.add('open')
    open_ = true
  }

  function close() {
    sheetEl.classList.remove('open')
    open_ = false
  }

  // Tap the handle bar to dismiss, same affordance as .spot-panel-handle.
  handle.addEventListener('click', close)

  return {
    open,
    close,
    get isOpen() { return open_ },
  }
}
