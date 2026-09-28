// Pure logic for the SpotManager mobile bottom-sheet: height clamping math
// plus small localStorage helpers for the remembered sheet height and the
// "desktop preferred" hint dismissal flag. No DOM/pointer wiring here —
// that lives in SpotManagerApp.vue, which calls into this module.

export const SHEET_HEIGHT_STORAGE_KEY = 'sm-sheet-height-vh'
export const HINT_DISMISSED_STORAGE_KEY = 'sm-desktop-hint-dismissed'

export const MIN_SHEET_VH = 18
export const MAX_SHEET_VH = 92
export const DEFAULT_SHEET_VH = 55

/**
 * Given the sheet's current height (vh) and a pointer-drag delta in px
 * (positive = pointer moved down, which shrinks the sheet; negative = moved
 * up, which grows it), return the new height clamped to [minVh, maxVh].
 */
export function clampSheetHeightVh(
  currentVh: number,
  deltaPx: number,
  viewportPx: number,
  minVh: number = MIN_SHEET_VH,
  maxVh: number = MAX_SHEET_VH,
): number {
  if (!viewportPx || viewportPx <= 0) return Math.min(maxVh, Math.max(minVh, currentVh))
  const deltaVh = (deltaPx / viewportPx) * 100
  const nextVh = currentVh - deltaVh
  return Math.min(maxVh, Math.max(minVh, nextVh))
}

/** Reads the remembered sheet height, falling back to the default if missing/corrupt/out of bounds. */
export function getStoredSheetHeightVh(): number {
  try {
    const raw = localStorage.getItem(SHEET_HEIGHT_STORAGE_KEY)
    if (raw === null) return DEFAULT_SHEET_VH
    const value = Number(raw)
    if (!Number.isFinite(value) || value < MIN_SHEET_VH || value > MAX_SHEET_VH) return DEFAULT_SHEET_VH
    return value
  } catch {
    return DEFAULT_SHEET_VH
  }
}

/** Persists the sheet height so it's restored on the next visit. */
export function setStoredSheetHeightVh(vh: number): void {
  try {
    localStorage.setItem(SHEET_HEIGHT_STORAGE_KEY, String(vh))
  } catch {
    // Storage unavailable (private browsing, quota) — silently skip persistence.
  }
}

/** Whether the "desktop preferred" hint was already dismissed in this browser. */
export function isHintDismissed(): boolean {
  try {
    return localStorage.getItem(HINT_DISMISSED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Marks the "desktop preferred" hint as dismissed so it never shows again. */
export function dismissHint(): void {
  try {
    localStorage.setItem(HINT_DISMISSED_STORAGE_KEY, 'true')
  } catch {
    // Storage unavailable — hint may reappear next visit, which is fine (non-blocking).
  }
}
