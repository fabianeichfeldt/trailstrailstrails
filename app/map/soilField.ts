import { axisRgb, SOIL_FROST } from './soilBadge'

export interface FieldPoint { x: number; y: number; axis: number; frost: boolean }
export interface FieldImage { width: number; height: number; data: Uint8ClampedArray }

export const MAX_ALPHA = 0.72
const CULL_SIGMAS = 3
const FROST_RGB = [1, 3, 5].map(i => parseInt(SOIL_FROST.slice(i, i + 2), 16)) as [number, number, number]

/** Gaussian σ in px; the visible cloud edge (~2σ) lands on the ground radius. */
export function sigmaPx(radiusMeters: number, metersPerPixel: number): number {
  return Math.max(1, radiusMeters / 2 / Math.max(metersPerPixel, 1e-6))
}

/**
 * Soil cloud as a low-res RGBA grid. Points are in full-res pixel space of a
 * w×h viewport; colour = weighted-mean axis, alpha = accumulated weight.
 */
export function renderField(
  points: FieldPoint[], w: number, h: number, sigma: number, scale = 0.25,
): FieldImage {
  const gw = Math.max(1, Math.ceil(w * scale))
  const gh = Math.max(1, Math.ceil(h * scale))
  const wSum = new Float32Array(gw * gh)
  const aSum = new Float32Array(gw * gh)
  const fSum = new Float32Array(gw * gh)
  const reach = sigma * CULL_SIGMAS
  const inv2s2 = 1 / (2 * sigma * sigma)

  for (const p of points) {
    // Cell centres sit at (c + .5) / scale in full-res space.
    const x0 = Math.max(0, Math.floor((p.x - reach) * scale - 0.5))
    const x1 = Math.min(gw - 1, Math.ceil((p.x + reach) * scale - 0.5))
    const y0 = Math.max(0, Math.floor((p.y - reach) * scale - 0.5))
    const y1 = Math.min(gh - 1, Math.ceil((p.y + reach) * scale - 0.5))
    const reach2 = reach * reach
    for (let cy = y0; cy <= y1; cy++) {
      const dy = (cy + 0.5) / scale - p.y
      for (let cx = x0; cx <= x1; cx++) {
        const dx = (cx + 0.5) / scale - p.x
        const d2 = dx * dx + dy * dy
        if (d2 > reach2) continue
        const k = Math.exp(-d2 * inv2s2)
        const i = cy * gw + cx
        wSum[i]! += k
        aSum[i]! += k * p.axis
        if (p.frost) fSum[i]! += k
      }
    }
  }

  const data = new Uint8ClampedArray(gw * gh * 4)
  for (let i = 0; i < wSum.length; i++) {
    const ws = wSum[i]!
    if (ws <= 0) continue
    const rgb = axisRgb(aSum[i]! / ws)
    const f = fSum[i]! / ws
    const o = i * 4
    for (let c = 0; c < 3; c++) data[o + c] = Math.round(rgb[c]! + (FROST_RGB[c]! - rgb[c]!) * f)
    const alpha = Math.min(MAX_ALPHA, Math.pow(Math.min(1, ws * 0.9), 0.8) * MAX_ALPHA)
    data[o + 3] = Math.round(alpha * 255)
  }
  return { width: gw, height: gh, data }
}
