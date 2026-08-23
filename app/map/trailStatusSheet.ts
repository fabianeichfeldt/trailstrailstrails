// Trail-status badge explanation: a small styled "info card" (headline,
// date range, hint, Trailcrew attribution) shown identically in a desktop
// Leaflet popup and a mobile bottom sheet.
//
// All dynamic text (hint, spot name) is set via textContent, never
// interpolated into an HTML string — both are free text that ultimately
// comes from the database (trailcrew-entered), so this avoids injecting
// arbitrary markup into the map.
//
// The sheet itself is visually consistent with the app's existing
// bottom-sheet pattern (.spot-panel: fixed to viewport bottom, rounded top
// corners, slide-up transform, drag-handle-style bar — see
// src/assets/css/marker.css and src/assets/css/spot_panel.css) without
// pulling in the full SpotPanel, which is a much larger, unrelated concern
// (tabs, GPX list, elevation...).

import type { TrailStatusResult } from '~/types/TrailStatus'

export interface TrailStatusSheet {
  open(status: TrailStatusResult, spotName: string): void
  close(): void
  readonly isOpen: boolean
}

/** Builds the shared status-info content block used by both the popup and the sheet. */
export function buildTrailStatusContent(status: TrailStatusResult, spotName: string): HTMLElement {
  const variant = status.state === 'closed' ? 'closed' : 'closing'

  const el = document.createElement('div')
  el.className = `trail-status-info trail-status-info-${variant}`

  const title = document.createElement('div')
  title.className = 'trail-status-info-title'
  title.textContent = status.title ?? ''
  el.appendChild(title)

  if (status.dateLine) {
    const date = document.createElement('div')
    date.className = 'trail-status-info-date'
    date.textContent = status.dateLine
    el.appendChild(date)
  }

  if (status.hint) {
    const hint = document.createElement('p')
    hint.className = 'trail-status-info-hint'
    hint.textContent = status.hint
    el.appendChild(hint)
  }

  const attribution = document.createElement('div')
  attribution.className = 'trail-status-info-attribution'
  attribution.textContent = `Hinweis von Trailcrew ${spotName}`
  el.appendChild(attribution)

  return el
}

export function createTrailStatusSheet(): TrailStatusSheet {
  let sheet = document.querySelector('.trail-status-sheet') as HTMLElement | null

  if (!sheet) {
    sheet = document.createElement('div')
    sheet.className = 'trail-status-sheet'
    sheet.innerHTML = `<div class="trail-status-sheet-handle"></div>`
    document.body.appendChild(sheet)
  }

  const sheetEl = sheet
  const handle  = sheetEl.querySelector('.trail-status-sheet-handle') as HTMLElement
  let contentEl: HTMLElement | null = null
  let open_ = false

  function open(status: TrailStatusResult, spotName: string) {
    contentEl?.remove()
    contentEl = buildTrailStatusContent(status, spotName)
    sheetEl.appendChild(contentEl)
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
