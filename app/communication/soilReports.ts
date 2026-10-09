import { FUNCTIONS, userHeaders } from './http'

/**
 * Rider feedback on the soil verdict, sent to the `soil-report` edge function.
 * The function derives everything else (user, model snapshot, observed date)
 * itself; the client sends only what the rider chose, so nothing more is put on
 * the wire than these fields.
 */
export type SoilReportFlag = 'snow' | 'frozen' | 'raining'

export interface SoilReport {
  spotType: string
  spotId: string
  /** ISO timestamp of the ride, within the last three days. */
  observedAt: string
  rangeLo: number
  rangeHi: number
  flags?: SoilReportFlag[]
}

export interface SoilReportResult {
  ok: boolean
  /** `no_soil_verdict`: the model had nothing to compare against at that time. */
  error?: 'no_soil_verdict' | 'failed'
}

/** Never throws: any failure becomes `{ ok: false, error }`. */
export async function submitSoilReport(report: SoilReport, token: string): Promise<SoilReportResult> {
  // Explicit picks, so a caller passing a wider object cannot leak fields.
  const body = {
    spotType: report.spotType,
    spotId: report.spotId,
    observedAt: report.observedAt,
    rangeLo: report.rangeLo,
    rangeHi: report.rangeHi,
    flags: report.flags ?? [],
  }
  try {
    const res = await fetch(`${FUNCTIONS}/soil-report`, {
      method: 'POST',
      headers: userHeaders(token),
      body: JSON.stringify(body),
    })
    if (res.ok) return { ok: true }
    if (res.status === 422) {
      const parsed = (await res.json()) as { error?: string } | null
      if (parsed?.error === 'no_soil_verdict') return { ok: false, error: 'no_soil_verdict' }
    }
    return { ok: false, error: 'failed' }
  } catch {
    return { ok: false, error: 'failed' }
  }
}
