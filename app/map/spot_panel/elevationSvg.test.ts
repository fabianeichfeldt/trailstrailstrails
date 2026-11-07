import { describe, it, expect, vi, afterEach } from 'vitest'
import { elevationSVG, bindElevationHover, IMBA, type AnyItem } from './elevationSvg'
import type { ElevationPoint, MtbTour, MtbTrail, TourSegment } from '../../types/MtbTypes'

// Known profile, chart geometry: W=300 PL=30 cW=264 PT=6 cH=64.
// maxD = 4 km, minA = 700, maxA = 800  =>  px(d) = 30 + d/4*264, py(a) = 70 - (a-700)*0.64
// Expected points: (30,70) (96,38) (162,70) (294,6)
const PROFILE: ElevationPoint[] = [
  { dist: 0, alt: 700 },
  { dist: 1, alt: 750 },
  { dist: 2, alt: 700 },
  { dist: 4, alt: 800 },
]

function gpxFor(profile: ElevationPoint[]): [number, number, number][] {
  return profile.map((p, i) => [47 + i / 10, 11 + i / 10, p.alt] as [number, number, number])
}

function trail(overrides: Partial<MtbTrail> = {}): MtbTrail {
  return {
    id: 't1', spotId: 's1', name: 'Testtrail', difficulty: 'blue',
    distance_km: 4, elevation_gain: 100, elevation_loss: 300,
    direction: 'one-way-down',
    gpxPoints: gpxFor(PROFILE), elevationProfile: PROFILE,
    ...overrides,
  }
}

function tour(overrides: Partial<MtbTour> = {}): MtbTour {
  return {
    id: 'tr1', spotId: 's1', name: 'Testtour',
    distance_km: 4, elevation_gain: 200, elevation_loss: 400,
    direction: 'cw', duration_minutes: 60, trailCount: 2,
    segments: [], gpxPoints: gpxFor(PROFILE), elevationProfile: PROFILE, hasFullGpx: true,
    ...overrides,
  }
}

const mounted: HTMLElement[] = []

function mountSvg(item: AnyItem, profile: ElevationPoint[] = PROFILE, segments?: TourSegment[]): SVGSVGElement {
  const host = document.createElement('div')
  host.innerHTML = elevationSVG(profile, item, segments)
  document.body.appendChild(host)
  mounted.push(host)
  return host.querySelector('svg') as SVGSVGElement
}

function rect(width: number) {
  return { left: 0, top: 0, width, height: 88, right: width, bottom: 88, x: 0, y: 0, toJSON() {} } as DOMRect
}

afterEach(() => {
  mounted.splice(0).forEach(h => h.remove())
  vi.restoreAllMocks()
})

describe('elevationSVG', () => {
  it('returns an empty string when there are fewer than two profile points', () => {
    expect(elevationSVG([], trail())).toBe('')
    expect(elevationSVG([{ dist: 0, alt: 500 }], trail())).toBe('')
  })

  it('renders a viewBox of 300x88 and an svg root', () => {
    const svg = mountSvg(trail())
    expect(svg.tagName.toLowerCase()).toBe('svg')
    expect(svg.getAttribute('viewBox')).toBe('0 0 300 88')
  })

  it('maps profile points to chart coordinates (x from distance, y inverted from altitude)', () => {
    const svg = mountSvg(trail())
    const line = svg.querySelector('polyline')!
    expect(line.getAttribute('points')).toBe('30.0,70.0 96.0,38.0 162.0,70.0 294.0,6.0')
  })

  it('draws a single-colour line in the difficulty colour for a trail', () => {
    const svg = mountSvg(trail({ difficulty: 'red' }))
    expect(svg.querySelector('polyline')!.getAttribute('stroke')).toBe(IMBA.red.hex)
  })

  it('falls back to neutral grey for a tour without difficulty', () => {
    const svg = mountSvg(tour())
    expect(svg.querySelector('polyline')!.getAttribute('stroke')).toBe('#666')
  })

  it('closes the area fill down to the baseline using the same points', () => {
    const svg = mountSvg(trail())
    const fill = svg.querySelector('path')!.getAttribute('d')
    expect(fill).toBe('M 30.0,70.0 L 96.0,38.0 L 162.0,70.0 L 294.0,6.0 L294.0,70.0 L30.0,70.0 Z')
  })

  it('labels the altitude axis with min, mid and max rounded to whole metres', () => {
    const svg = mountSvg(trail())
    const yLabels = [...svg.querySelectorAll('text[text-anchor="end"]')]
    expect(yLabels.map(t => t.textContent)).toEqual(['700', '750', '800'])
    expect(yLabels.map(t => Number(t.getAttribute('y')))).toEqual([73.5, 41.5, 9.5])
  })

  it('rounds altitude labels to the nearest metre', () => {
    const profile = [{ dist: 0, alt: 712.4 }, { dist: 1, alt: 812.6 }]
    const svg = mountSvg(trail(), profile)
    const yLabels = [...svg.querySelectorAll('text[text-anchor="end"]')].map(t => t.textContent)
    // mid = 762.5, and Math.round rounds half up
    expect(yLabels).toEqual(['712', '763', '813'])
  })

  it('labels the distance axis at start, midpoint and end with one decimal km', () => {
    const svg = mountSvg(trail())
    const xLabels = [...svg.querySelectorAll('text[font-size="8"][text-anchor="middle"]')]
    expect(xLabels.map(t => t.textContent)).toEqual(['0.0 km', '2.0 km', '4.0 km'])
    expect(xLabels.map(t => t.getAttribute('x'))).toEqual(['30.0', '162.0', '294.0'])
  })

  it('spaces x coordinates evenly for evenly spaced distances (no staircase)', () => {
    // Regression guard: duplicated distance rounding once produced a staircase profile.
    const profile = Array.from({ length: 50 }, (_, i) => ({ dist: i * 0.1, alt: 600 + (i % 7) * 10 }))
    const svg = mountSvg(trail(), profile)
    const xs = svg.querySelector('polyline')!.getAttribute('points')!
      .split(' ').map(pt => Number(pt.split(',')[0]))
    expect(xs).toHaveLength(50)
    // step is 6.6px; coordinates are rounded to 0.1px, so allow +/-0.1 per gap
    const step = xs[1] - xs[0]
    for (let i = 1; i < xs.length; i++) {
      expect(Math.abs((xs[i] - xs[i - 1]) - step)).toBeLessThanOrEqual(0.11)
    }
    expect(xs[0]).toBeCloseTo(30, 1)
    expect(xs[49]).toBeCloseTo(294, 1)
  })

  it('handles a flat profile without NaN coordinates', () => {
    const flat = [{ dist: 0, alt: 500 }, { dist: 1, alt: 500 }]
    const html = elevationSVG(flat, trail())
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
  })

  it('renders a two-point profile', () => {
    const two = [{ dist: 0, alt: 100 }, { dist: 2, alt: 200 }]
    const svg = mountSvg(trail(), two)
    expect(svg.querySelector('polyline')!.getAttribute('points')).toBe('30.0,70.0 294.0,6.0')
  })

  it('starts with the scrubber hidden', () => {
    const svg = mountSvg(trail())
    expect(svg.querySelector('.elev-scrubber')!.getAttribute('visibility')).toBe('hidden')
  })

  describe('with segments', () => {
    // 5 profile points split as trail(3) + transfer(2)
    const FIVE: ElevationPoint[] = [
      { dist: 0, alt: 700 }, { dist: 1, alt: 750 }, { dist: 2, alt: 800 },
      { dist: 3, alt: 760 }, { dist: 4, alt: 700 },
    ]
    const segments: TourSegment[] = [
      { type: 'trail', trailId: 't1', difficulty: 'green', gpxPoints: gpxFor(FIVE).slice(0, 3) },
      { type: 'transfer', gpxPoints: gpxFor(FIVE).slice(3, 5) },
    ]

    it('draws one polyline per segment, colour and width by segment type', () => {
      const svg = mountSvg(tour({ segments }), FIVE, segments)
      const lines = svg.querySelectorAll('polyline')
      expect(lines).toHaveLength(2)
      expect(lines[0].getAttribute('stroke')).toBe(IMBA.green.hex)
      expect(lines[0].getAttribute('stroke-width')).toBe('2.2')
      expect(lines[0].getAttribute('opacity')).toBe('1')
      expect(lines[1].getAttribute('stroke')).toBe('#aaa')
      expect(lines[1].getAttribute('stroke-width')).toBe('1.5')
      expect(lines[1].getAttribute('opacity')).toBe('0.6')
    })

    it('slices profile points into each segment in order', () => {
      const svg = mountSvg(tour({ segments }), FIVE, segments)
      const lines = svg.querySelectorAll('polyline')
      expect(lines[0].getAttribute('points')).toBe('30.0,70.0 96.0,38.0 162.0,6.0')
      // transfer starts at profile index 3 (dist 3 => x=228, alt 760 => y=31.6)
      expect(lines[1].getAttribute('points')).toBe('228.0,31.6 294.0,70.0')
    })

    it('uses a plain area fill, not a gradient, when segments are given', () => {
      const svg = mountSvg(tour({ segments }), FIVE, segments)
      expect(svg.querySelector('linearGradient')).toBeNull()
      expect(svg.querySelector('path')!.getAttribute('fill')).toBe('rgba(0,0,0,0.04)')
    })

    // Bug: IMBA[seg.difficulty!] threw for a trail segment without difficulty.
    it('draws a trail segment without difficulty in neutral grey instead of throwing', () => {
      const noDiff: TourSegment[] = [
        { type: 'trail', trailId: 't1', gpxPoints: gpxFor(FIVE).slice(0, 3) },
        { type: 'transfer', gpxPoints: gpxFor(FIVE).slice(3, 5) },
      ]
      const svg = mountSvg(tour({ segments: noDiff }), FIVE, noDiff)
      const lines = svg.querySelectorAll('polyline')
      expect(lines[0].getAttribute('stroke')).toBe('#888')
      expect(lines[0].getAttribute('stroke-width')).toBe('2.2')
    })

    it('skips a segment with fewer than two points', () => {
      const single: TourSegment[] = [
        { type: 'trail', trailId: 't1', difficulty: 'blue', gpxPoints: gpxFor(FIVE).slice(0, 1) },
        { type: 'transfer', gpxPoints: gpxFor(FIVE).slice(1, 5) },
      ]
      const svg = mountSvg(tour({ segments: single }), FIVE, single)
      const lines = svg.querySelectorAll('polyline')
      expect(lines).toHaveLength(1)
      expect(lines[0].getAttribute('stroke')).toBe('#aaa')
    })
  })

  describe('gradient fill (no segments)', () => {
    it('uses the difficulty colour for the gradient id and stops', () => {
      const svg = mountSvg(trail({ difficulty: 'black' }))
      const grad = svg.querySelector('linearGradient')!
      expect(grad.getAttribute('id')).toBe('eg-black')
      const stops = [...grad.querySelectorAll('stop')]
      expect(stops.map(s => s.getAttribute('stop-color'))).toEqual([IMBA.black.hex, IMBA.black.hex])
      expect(stops.map(s => s.getAttribute('stop-opacity'))).toEqual(['0.22', '0.03'])
      expect(svg.querySelector('path')!.getAttribute('fill')).toBe('url(#eg-black)')
    })

    it('uses a tour gradient id and grey stops for a tour', () => {
      const svg = mountSvg(tour())
      expect(svg.querySelector('linearGradient')!.getAttribute('id')).toBe('eg-tour')
      expect(svg.querySelector('stop')!.getAttribute('stop-color')).toBe('#666')
    })
  })
})

describe('bindElevationHover', () => {
  function setup(item: AnyItem, width = 300) {
    const svg = mountSvg(item)
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(rect(width))
    const onHover = vi.fn()
    const onLeave = vi.fn()
    bindElevationHover(svg, item, onHover, onLeave)
    const scrubber = svg.querySelector('.elev-scrubber')!
    const line = svg.querySelector('.elev-scrub-line')!
    const dot = svg.querySelector('.elev-scrub-dot')!
    const txt = svg.querySelector('.elev-scrub-txt')!
    const move = (clientX: number) => svg.dispatchEvent(new MouseEvent('mousemove', { clientX }))
    return { svg, onHover, onLeave, scrubber, line, dot, txt, move }
  }

  it('does nothing for an item with fewer than two GPX points', () => {
    const svg = mountSvg(trail({ gpxPoints: [[47, 11, 700]] }), PROFILE)
    const onHover = vi.fn()
    const onLeave = vi.fn()
    bindElevationHover(svg, trail({ gpxPoints: [[47, 11, 700]] }), onHover, onLeave)
    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 162 }))
    svg.dispatchEvent(new MouseEvent('mouseleave'))
    expect(onHover).not.toHaveBeenCalled()
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('snaps to the nearest profile point and reports its GPX lat/lng and colour', () => {
    const item = trail({ difficulty: 'red' })
    const { onHover, move } = setup(item)
    move(162) // chart x 132 => dist 2 => index 2
    expect(onHover).toHaveBeenCalledTimes(1)
    const [latlng, color] = onHover.mock.calls[0]
    expect(latlng).toEqual([item.gpxPoints[2][0], item.gpxPoints[2][1]])
    expect(color).toBe(IMBA.red.hex)
  })

  it('reports grey for a tour', () => {
    const item = tour()
    const { onHover, move } = setup(item)
    move(96)
    expect(onHover.mock.calls[0][1]).toBe('#444')
  })

  it('scales client x by the rendered width (viewBox to pixels)', () => {
    const item = trail()
    // rendered at 600px => scale 0.5; client 324 => svg 162 => index 2
    const { onHover, move } = setup(item, 600)
    move(324)
    expect(onHover.mock.calls[0][0]).toEqual([item.gpxPoints[2][0], item.gpxPoints[2][1]])
  })

  it('picks the closest index by distance for uneven spacing', () => {
    const item = trail()
    // dist 3.2 is closer to dist 4 (index 3) than to dist 2 (index 2)
    const { onHover, move } = setup(item)
    move(30 + (3.2 / 4) * 264)
    expect(onHover.mock.calls[0][0]).toEqual([item.gpxPoints[3][0], item.gpxPoints[3][1]])
  })

  it('clamps positions left of the chart to the first point and right of it to the last', () => {
    const item = trail()
    const { onHover, move } = setup(item)
    move(0)
    expect(onHover.mock.calls[0][0]).toEqual([item.gpxPoints[0][0], item.gpxPoints[0][1]])
    move(1000)
    expect(onHover.mock.calls[1][0]).toEqual([item.gpxPoints[3][0], item.gpxPoints[3][1]])
  })

  it('moves the scrubber line and dot to the hovered point and shows the altitude', () => {
    const { scrubber, line, dot, txt, move } = setup(trail())
    move(162) // index 2: alt 700 => y 70
    expect(scrubber.hasAttribute('visibility')).toBe(false)
    expect(line.getAttribute('x1')).toBe('162')
    expect(line.getAttribute('x2')).toBe('162')
    expect(dot.getAttribute('cx')).toBe('162')
    expect(dot.getAttribute('cy')).toBe('70')
    expect(txt.textContent).toBe('700 m')
  })

  it('places the label above the point when it sits in the lower half, below when in the upper half', () => {
    const { txt, move } = setup(trail())
    move(162) // y=70 is in lower half (> 38) => label above: 70 - 7 = 63
    expect(txt.getAttribute('y')).toBe('63')
    move(294) // y=6 is in upper half => label below: 6 + 14 = 20
    expect(txt.getAttribute('y')).toBe('20')
    expect(txt.textContent).toBe('800 m')
  })

  it('keeps the label x inside 18..282 so it does not run off the chart', () => {
    const { txt, move } = setup(trail())
    move(294) // x = 294 => clamped to 282
    expect(txt.getAttribute('x')).toBe('282')
    move(162)
    expect(txt.getAttribute('x')).toBe('162')
  })

  it('colours the dot with the item colour', () => {
    const { dot, move } = setup(trail({ difficulty: 'green' }))
    move(96)
    expect(dot.getAttribute('stroke')).toBe(IMBA.green.hex)
  })

  it('hides the scrubber and calls onLeave on mouseleave', () => {
    const { svg, scrubber, onLeave, move } = setup(trail())
    move(162)
    svg.dispatchEvent(new MouseEvent('mouseleave'))
    expect(scrubber.getAttribute('visibility')).toBe('hidden')
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('handles touchmove like mousemove and prevents page scrolling', () => {
    const item = trail()
    const { svg, onHover, scrubber } = setup(item)
    const ev = new Event('touchmove', { cancelable: true })
    Object.defineProperty(ev, 'touches', { value: [{ clientX: 96 }] })
    svg.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(onHover.mock.calls[0][0]).toEqual([item.gpxPoints[1][0], item.gpxPoints[1][1]])
    expect(scrubber.hasAttribute('visibility')).toBe(false)
  })

  // Bug: profile had more points than gpxPoints, so gpx[idx] was undefined and threw.
  it('maps hovered profile points onto a shorter gpxPoints array without throwing', () => {
    const item = trail({ gpxPoints: gpxFor(PROFILE).slice(0, 2) })
    const { onHover, move } = setup(item)
    expect(() => move(294)).not.toThrow() // profile index 3, gpx has only 2 points
    expect(onHover.mock.calls[0][0]).toEqual([item.gpxPoints[1][0], item.gpxPoints[1][1]])
  })

  it('touchend hides the scrubber and calls onLeave', () => {
    const { svg, scrubber, onLeave, move } = setup(trail())
    move(162)
    svg.dispatchEvent(new Event('touchend'))
    expect(scrubber.getAttribute('visibility')).toBe('hidden')
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
