import type { TrailDetails } from '~/types/TrailDetails'

export type SpotStatus = 'open' | 'limited' | 'closed' | 'unknown'

export interface EffectiveStatus {
  status: SpotStatus
  reason?: string
}

export const STATUS_META: Record<SpotStatus, { label: string; cls: string }> = {
  open:    { label: 'Geöffnet',         cls: 'ssb-open' },
  limited: { label: 'Eingeschränkt',    cls: 'ssb-limited' },
  closed:  { label: 'Geschlossen',      cls: 'ssb-closed' },
  unknown: { label: 'Status unbekannt', cls: 'ssb-unknown' },
}

export const ACCESS_META: Record<'paid' | 'membership', { label: string }> = {
  paid:       { label: 'Kostenpflichtig' },
  membership: { label: 'Mitgliedschaft' },
}

/**
 * Resolves a spot's raw TrailDetails status fields (status/status_until/
 * seasonal_from/seasonal_to) into what the status banner should actually
 * show right now.
 *
 * Ported out of the legacy string-templating path
 * (app/map/detail_popup/detailsPopup.ts's renderSpotStatusBanner) as a pure,
 * independently testable function — part of converting
 * SpotPanelInfoTab.vue's raw-HTML render into a proper Vue component
 * (app/components/trail_detail/SpotDetailInfo.vue).
 */
export function computeEffectiveStatus(
  d: Pick<TrailDetails, 'status' | 'status_until' | 'seasonal_from' | 'seasonal_to'>,
): EffectiveStatus {
  const s = d.status ?? 'open'
  if (s !== 'open' && d.status_until) {
    if (new Date() > new Date(d.status_until + 'T23:59:59')) return { status: 'open' }
  }
  if (d.seasonal_from && d.seasonal_to) {
    const today = new Date()
    const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const from = d.seasonal_from
    const to = d.seasonal_to
    const inSeason = from <= to ? mmdd >= from && mmdd <= to : mmdd >= from || mmdd <= to
    if (inSeason) {
      const [fm, fd] = from.split('-')
      const [tm, td] = to.split('-')
      return { status: 'closed', reason: `Saisonale Sperrung ${fd}.${fm}. – ${td}.${tm}.` }
    }
  }
  return { status: s }
}
