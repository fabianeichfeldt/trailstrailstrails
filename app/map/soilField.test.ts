import { describe, it, expect } from 'vitest'
import { sigmaPx, renderField, MAX_ALPHA } from './soilField'
import { axisRgb, SOIL_FROST } from './soilBadge'

const px = (img: { width: number; data: Uint8ClampedArray }, x: number, y: number) => {
  const i = (y * img.width + x) * 4
  return [...img.data.slice(i, i + 4)]
}

describe('sigmaPx', () => {
  it('converts ground radius to pixels (cloud edge ≈ 2σ)', () => {
    expect(sigmaPx(20_000, 100)).toBe(100)
    expect(sigmaPx(20_000, 200)).toBe(50)
  })
  it('never collapses below 1px', () => {
    expect(sigmaPx(100, 10_000)).toBe(1)
  })
  it('guards against a zero scale', () => {
    expect(Number.isFinite(sigmaPx(20_000, 0))).toBe(true)
  })
})

describe('renderField', () => {
  it('outputs a quarter-resolution grid by default', () => {
    const img = renderField([], 400, 200, 20)
    expect(img.width).toBe(100)
    expect(img.height).toBe(50)
    expect(img.data.length).toBe(100 * 50 * 4)
  })
  it('is fully transparent without points', () => {
    const img = renderField([], 40, 40, 10)
    expect(img.data.every(v => v === 0)).toBe(true)
  })
  it('colours the spot centre with its axis colour and caps alpha', () => {
    const img = renderField([{ x: 100, y: 100, axis: 2, frost: false }], 200, 200, 20)
    const [r, g, b, a] = px(img, 25, 25)
    expect([r, g, b]).toEqual(axisRgb(2))
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThanOrEqual(Math.round(MAX_ALPHA * 255))
  })
  it('leaves cells beyond 3σ untouched (culling)', () => {
    const img = renderField([{ x: 20, y: 20, axis: 2, frost: false }], 400, 400, 10)
    // 3σ = 30px → cell at x=300 (full-res) is way outside.
    expect(px(img, 75, 75)[3]).toBe(0)
    expect(px(img, 5, 5)[3]).toBeGreaterThan(0)
  })
  it('alpha falls off with distance', () => {
    const img = renderField([{ x: 100, y: 100, axis: 1, frost: false }], 200, 200, 20)
    expect(px(img, 25, 25)[3]).toBeGreaterThan(px(img, 35, 25)[3]!)
  })
  it('mixes colour between two spots', () => {
    const pts = [
      { x: 42, y: 100, axis: 0, frost: false },
      { x: 162, y: 100, axis: 4, frost: false },
    ]
    const img = renderField(pts, 200, 200, 40)
    const mid = px(img, 25, 25)
    expect(mid[3]).toBeGreaterThan(0)
    const [r, g, b] = mid as number[]
    expect([r, g, b]).toEqual(axisRgb(2))
    const nearLeft = px(img, 12, 25)
    expect(nearLeft[0]).toBeGreaterThan(nearLeft[2]!) // dusty orange side: red > blue
  })
  it('accumulates alpha where clouds overlap', () => {
    const one = renderField([{ x: 100, y: 100, axis: 2, frost: false }], 200, 200, 30)
    const two = renderField([
      { x: 100, y: 100, axis: 2, frost: false },
      { x: 104, y: 100, axis: 2, frost: false },
    ], 200, 200, 30)
    expect(px(two, 25, 25)[3]).toBeGreaterThanOrEqual(px(one, 25, 25)[3]!)
  })
  it('blends frost spots toward the frost tint', () => {
    const plain = renderField([{ x: 100, y: 100, axis: 4, frost: false }], 200, 200, 20)
    const frosty = renderField([{ x: 100, y: 100, axis: 4, frost: true }], 200, 200, 20)
    const [fr, fg, fb] = [0xe8, 0xf4, 0xff]
    expect(SOIL_FROST).toBe('#e8f4ff')
    const p = px(plain, 25, 25) as number[]
    const f = px(frosty, 25, 25) as number[]
    expect(Math.abs(f[0]! - fr!)).toBeLessThan(Math.abs(p[0]! - fr!))
    expect(Math.abs(f[1]! - fg!)).toBeLessThan(Math.abs(p[1]! - fg!))
    expect(Math.abs(f[2]! - fb!)).toBeLessThan(Math.abs(p[2]! - fb!))
  })
  it('ignores points far outside the grid without throwing', () => {
    const img = renderField([{ x: -5000, y: 9000, axis: 2, frost: false }], 100, 100, 10)
    expect(img.data.every(v => v === 0)).toBe(true)
  })
  it('honours a custom scale', () => {
    const img = renderField([], 100, 100, 10, 0.5)
    expect(img.width).toBe(50)
  })
})
