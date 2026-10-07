import { describe, it, expect } from 'vitest'
import {
  SOIL_PALETTE, SOIL_FROST, SOIL_GLYPHS, axisColor, axisRgb,
  soilBadgeHtml, markerWithSoilBadgeOptions, clusterDonutHtml, soilChipOptions,
} from './soilBadge'
import { markerIconOptions } from './markerIcon'

describe('palette', () => {
  it('is the L1 Earth ramp', () => {
    expect(SOIL_PALETTE).toEqual(['#e0a526', '#8bbf3f', '#16c060', '#2ea8e6', '#6d4c41'])
    expect(SOIL_FROST).toBe('#e8f4ff')
  })
})

describe('axisColor / axisRgb', () => {
  it('hits the stops exactly at integer axes', () => {
    expect(axisColor(0)).toBe('#e0a526')
    expect(axisColor(2)).toBe('#16c060')
    expect(axisColor(4)).toBe('#6d4c41')
  })
  it('interpolates between stops', () => {
    expect(axisRgb(0.5)).toEqual([
      Math.round((0xe0 + 0x8b) / 2), Math.round((0xa5 + 0xbf) / 2), Math.round((0x26 + 0x3f) / 2),
    ])
  })
  it('clamps out-of-range axes', () => {
    expect(axisColor(-3)).toBe(axisColor(0))
    expect(axisColor(9)).toBe(axisColor(4))
  })
})

describe('SOIL_GLYPHS', () => {
  it('has an svg for every renderable level', () => {
    for (const l of ['dusty', 'dry', 'prime', 'damp', 'wet', 'raining', 'snow'] as const) {
      expect(SOIL_GLYPHS[l]).toMatch(/^<svg[\s\S]*<\/svg>$/)
    }
  })
})

describe('soilBadgeHtml', () => {
  it('returns empty for unknown and hard', () => {
    expect(soilBadgeHtml('unknown')).toBe('')
    expect(soilBadgeHtml('hard')).toBe('')
  })
  it('renders level class and glyph', () => {
    const h = soilBadgeHtml('dry')
    expect(h).toContain('soil-badge')
    expect(h).toContain('soil-badge-dry')
    expect(h).toContain('<svg')
  })
  it('marks prime as hero (glow)', () => {
    expect(soilBadgeHtml('prime')).toContain('soil-badge-hero')
    expect(soilBadgeHtml('dry')).not.toContain('soil-badge-hero')
  })
  it('only animates in when a delay is given', () => {
    expect(soilBadgeHtml('wet')).not.toContain('soil-badge-pop')
    const h = soilBadgeHtml('wet', { delayMs: 320.4 })
    expect(h).toContain('soil-badge-pop')
    expect(h).toContain('animation-delay:320ms')
  })
  it('raining/snow use their own glyphs', () => {
    expect(SOIL_GLYPHS.raining).not.toBe(SOIL_GLYPHS.damp)
    expect(SOIL_GLYPHS.snow).not.toBe(SOIL_GLYPHS.wet)
    expect(soilBadgeHtml('snow')).toContain('soil-badge-snow')
  })
})

describe('markerWithSoilBadgeOptions', () => {
  it('keeps the pin geometry of markerIconOptions', () => {
    const base = markerIconOptions('trail', true)
    const o = markerWithSoilBadgeOptions('trail', true, 'prime', 100)
    expect(o.iconSize).toEqual(base.iconSize)
    expect(o.iconAnchor).toEqual(base.iconAnchor)
    expect(o.popupAnchor).toEqual(base.popupAnchor)
    expect(o.html).toContain(base.html)
    expect(o.html).toContain('soil-badge-prime')
  })
  it('falls back to the plain pin without a renderable level', () => {
    expect(markerWithSoilBadgeOptions('bikepark', true, 'unknown')).toEqual(markerIconOptions('bikepark', true))
  })
})

describe('clusterDonutHtml', () => {
  it('shows the child count', () => {
    expect(clusterDonutHtml(['dry', 'dry', 'wet'])).toContain('>3<')
  })
  it('builds conic shares per palette bucket in axis order', () => {
    const h = clusterDonutHtml(['prime', 'prime', 'dry', 'dry'])
    expect(h).toContain('conic-gradient(#8bbf3f 0% 50%, #16c060 50% 100%)')
  })
  it('merges raining into damp', () => {
    expect(clusterDonutHtml(['damp', 'raining'])).toContain('conic-gradient(#2ea8e6 0% 100%)')
  })
  it('glows if any child is prime', () => {
    expect(clusterDonutHtml(['dry', 'prime'])).toContain('soil-donut-glow')
    expect(clusterDonutHtml(['dry', 'wet'])).not.toContain('soil-donut-glow')
  })
  it('renders unknown children as neutral grey but still counts them', () => {
    const h = clusterDonutHtml(['dry', 'unknown'])
    expect(h).toContain('#c9ccd0')
    expect(h).toContain('>2<')
  })
  it('handles an empty list', () => {
    expect(clusterDonutHtml([])).toContain('>0<')
  })
})

describe('soilChipOptions', () => {
  it('is null for non-renderable levels', () => {
    expect(soilChipOptions('hard')).toBeNull()
    expect(soilChipOptions('unknown')).toBeNull()
  })
  it('returns marker options with glyph and German label', () => {
    const o = soilChipOptions('prime')!
    expect(o.html).toContain('soil-chip-prime')
    expect(o.html).toContain('Hero Dirt')
    expect(o.html).toContain('<svg')
    expect(o.iconSize[0]).toBeGreaterThan(0)
    expect(o.className).toContain('soil-chip-hit')
  })
})
