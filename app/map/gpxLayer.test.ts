// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createHideController, bindTooltipHover, createTapDetector, createLineHighlighter, addTrackLayer,
} from './gpxLayer'

describe('createHideController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('hides the element after 800 ms when schedule() is called', () => {
    const el = { style: { display: 'block' } } as HTMLElement
    const hide = createHideController(el)
    hide.schedule()
    vi.advanceTimersByTime(799)
    expect(el.style.display).toBe('block')
    vi.advanceTimersByTime(1)
    expect(el.style.display).toBe('none')
  })

  it('cancel() prevents the element from being hidden', () => {
    const el = { style: { display: 'block' } } as HTMLElement
    const hide = createHideController(el)
    hide.schedule()
    hide.cancel()
    vi.advanceTimersByTime(1000)
    expect(el.style.display).toBe('block')
  })

  it('schedule() resets the timer when called a second time', () => {
    const el = { style: { display: 'block' } } as HTMLElement
    const hide = createHideController(el)
    hide.schedule()
    vi.advanceTimersByTime(400)
    hide.schedule()
    vi.advanceTimersByTime(400)
    expect(el.style.display).toBe('block')
    vi.advanceTimersByTime(400)
    expect(el.style.display).toBe('none')
  })

  it('takes a custom delay and runs onHide after hiding', () => {
    const el = { style: { display: 'block' } } as HTMLElement
    const onHide = vi.fn()
    createHideController(el, onHide).schedule(3000)
    vi.advanceTimersByTime(2999)
    expect(onHide).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(el.style.display).toBe('none')
    expect(onHide).toHaveBeenCalledOnce()
  })
})

describe('bindTooltipHover', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('keeps the tooltip while hovered and hides it on leave', () => {
    const el = document.createElement('div')
    el.style.display = 'block'
    const hide = createHideController(el)
    bindTooltipHover(el, hide)
    hide.schedule()
    el.dispatchEvent(new Event('mouseenter'))
    vi.advanceTimersByTime(1000)
    expect(el.style.display).toBe('block')
    el.dispatchEvent(new Event('mouseleave'))
    expect(el.style.display).toBe('none')
  })
})

describe('createTapDetector', () => {
  it('detects a second tap on the same id inside the window', () => {
    let t = 1000
    const d = createTapDetector(350, () => t)
    expect(d.tap('a')).toBe(false)
    t += 349
    expect(d.tap('a')).toBe(true)
  })

  it('does not count a tap at exactly the window length', () => {
    let t = 1000
    const d = createTapDetector(350, () => t)
    d.tap('a')
    t += 350
    expect(d.tap('a')).toBe(false)
  })

  it('does not count a tap on a different id', () => {
    let t = 1000
    const d = createTapDetector(350, () => t)
    d.tap('a')
    t += 100
    expect(d.tap('b')).toBe(false)
    t += 100
    expect(d.tap('b')).toBe(true)
  })

  it('resets after a double tap so a third tap starts over', () => {
    let t = 1000
    const d = createTapDetector(350, () => t)
    d.tap('a'); t += 50
    expect(d.tap('a')).toBe(true); t += 50
    expect(d.tap('a')).toBe(false)
  })

  it('handles a first tap at time zero', () => {
    const d = createTapDetector(350, () => 0)
    expect(d.tap('a')).toBe(false)
    expect(d.tap('a')).toBe(true)
  })
})

// ── fake Leaflet ────────────────────────────────────────────────────────────
type Handler = (e: any) => void
function fakeLine(opts: any) {
  const handlers: Record<string, { fn: Handler; ctx?: any }> = {}
  const line: any = {
    opts, handlers, styles: [] as any[], front: 0,
    addTo(parent: any) { parent.added.push(line); return line },
    on(ev: string, fn: Handler, ctx?: any) { handlers[ev] = { fn, ctx }; return line },
    setStyle(s: any) { line.styles.push(s) },
    bringToFront() { line.front++ },
  }
  return line
}
function setup(over: Record<string, any> = {}) {
  const lines: any[] = []
  const L = {
    polyline: (_l: any, opts: any) => { const l = fakeLine(opts); lines.push(l); return l },
    DomEvent: { stop: vi.fn() },
  }
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800 })
  container.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect
  const map = { getContainer: () => container }
  const parent = { added: [] as any[] }
  const tooltipEl = document.createElement('div')
  container.appendChild(tooltipEl)
  const hide = createHideController(tooltipEl)
  const onOpen = vi.fn()
  const res = addTrackLayer({
    L, map, parent, tooltipEl, hide, onOpen,
    latlngs: [[1, 2], [3, 4]], visibleOpts: { color: '#123', weight: 4, opacity: 0.85 },
    name: 'Flow Line', difficulty: 'blue', points: [[1, 2, 10], [3, 4, 20]], description: 'desc',
    ...over,
  })
  return { L, res, lines, parent, tooltipEl, hide, onOpen }
}
const mouse = (x = 5, y = 6) => ({ containerPoint: { x, y } })
const touch = (x = 110, y = 120) => ({ originalEvent: { touches: [{ clientX: x, clientY: y }] } })

describe('addTrackLayer', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('adds a non-interactive visible line and a wide near-invisible hit line', () => {
    const { res, parent } = setup()
    expect(parent.added).toEqual([res.line, res.hit])
    expect(res.line.opts).toEqual({ color: '#123', weight: 4, opacity: 0.85, interactive: false })
    expect(res.hit.opts).toEqual({ weight: 20, opacity: 0.001, color: '#000' })
  })

  it('shows the tooltip on mouseover and hides it 800 ms after mouseout', () => {
    const { res, tooltipEl } = setup()
    res.hit.handlers.mouseover.fn(mouse())
    expect(tooltipEl.innerHTML).toContain('Flow Line')
    expect(tooltipEl.style.display).not.toBe('none')
    res.hit.handlers.mouseout.fn()
    vi.advanceTimersByTime(800)
    expect(tooltipEl.style.display).toBe('none')
  })

  it('a re-entering mouseover cancels a pending hide', () => {
    const { res, tooltipEl } = setup()
    res.hit.handlers.mouseover.fn(mouse())
    res.hit.handlers.mouseout.fn()
    vi.advanceTimersByTime(400)
    res.hit.handlers.mouseover.fn(mouse())
    vi.advanceTimersByTime(1000)
    expect(tooltipEl.style.display).not.toBe('none')
  })

  it('truncates descriptions over 150 words and keeps shorter ones whole', () => {
    const long = Array.from({ length: 151 }, (_, i) => `w${i}`).join(' ')
    const a = setup({ description: long })
    a.res.hit.handlers.mouseover.fn(mouse())
    expect(a.tooltipEl.innerHTML).toContain('w149…')
    expect(a.tooltipEl.innerHTML).not.toContain('w150')

    const exact = Array.from({ length: 150 }, (_, i) => `w${i}`).join(' ')
    const b = setup({ description: exact })
    b.res.hit.handlers.mouseover.fn(mouse())
    expect(b.tooltipEl.innerHTML).toContain('w149')
    expect(b.tooltipEl.innerHTML).not.toContain('…')
  })

  it('the "Spot öffnen" button calls onOpen once and stops propagation', () => {
    const { res, tooltipEl, onOpen } = setup()
    res.hit.handlers.mouseover.fn(mouse())
    const btn = tooltipEl.querySelector('.ttr-open')!
    const ev = new Event('click', { bubbles: true })
    const stop = vi.spyOn(ev, 'stopPropagation')
    btn.dispatchEvent(ev)
    btn.dispatchEvent(new Event('click'))
    expect(onOpen).toHaveBeenCalledOnce()
    expect(stop).toHaveBeenCalled()
  })

  it('adds the extra action html to the tooltip bottom row', () => {
    const { res, tooltipEl } = setup({ extraActionHtml: () => '<a class="extra">x</a>' })
    res.hit.handlers.mouseover.fn(mouse())
    expect(tooltipEl.querySelector('.ttr-bottom .extra')).not.toBeNull()
  })

  it('wires no open handler without onOpen, and click only when onClick is given', () => {
    const none = setup({ onOpen: undefined })
    none.res.hit.handlers.mouseover.fn(mouse())
    expect(() => none.tooltipEl.querySelector('.ttr-open')!.dispatchEvent(new Event('click'))).not.toThrow()
    expect(none.res.hit.handlers.click).toBeUndefined()

    const onClick = vi.fn()
    const withClick = setup({ onClick })
    withClick.res.hit.handlers.click.fn({})
    expect(onClick).toHaveBeenCalledOnce()
  })

  describe('without doubleTap (mini map)', () => {
    it('a passive single tap shows the tooltip at the touch point and hides it after 3 s', () => {
      const { res, tooltipEl } = setup()
      expect(res.hit.handlers.touchstart.ctx).toEqual({ passive: true })
      expect(res.hit.handlers.dblclick).toBeUndefined()
      res.hit.handlers.touchstart.fn(touch())
      expect(tooltipEl.innerHTML).toContain('Flow Line')
      vi.advanceTimersByTime(2999)
      expect(tooltipEl.style.display).not.toBe('none')
      vi.advanceTimersByTime(1)
      expect(tooltipEl.style.display).toBe('none')
    })

    it('a second tap restarts the 3 s window', () => {
      const { res, tooltipEl } = setup()
      res.hit.handlers.touchstart.fn(touch())
      vi.advanceTimersByTime(2000)
      res.hit.handlers.touchstart.fn(touch())
      vi.advanceTimersByTime(2000)
      expect(tooltipEl.style.display).not.toBe('none')
      vi.advanceTimersByTime(1000)
      expect(tooltipEl.style.display).toBe('none')
    })

    it('does not cancel a pending mouse hide on touch', () => {
      const { res, tooltipEl } = setup()
      res.hit.handlers.mouseout.fn()
      res.hit.handlers.touchstart.fn(touch())
      vi.advanceTimersByTime(800)
      expect(tooltipEl.style.display).toBe('none')
    })
  })

  describe('with doubleTap (live map)', () => {
    let now = 0
    const detector = () => createTapDetector(350, () => now)
    beforeEach(() => { now = 1000 })

    it('opens on dblclick and swallows the event', () => {
      const { res, L, onOpen } = setup({ doubleTap: { detector: detector(), id: 's1' } })
      const ev = {}
      res.hit.handlers.dblclick.fn(ev)
      expect(L.DomEvent.stop).toHaveBeenCalledWith(ev)
      expect(onOpen).toHaveBeenCalledOnce()
    })

    it('a non-passive single tap shows the tooltip, a quick second tap on the same trail opens', () => {
      const { res, L, onOpen, tooltipEl } = setup({ doubleTap: { detector: detector(), id: 's1' } })
      expect(res.hit.handlers.touchstart.ctx).toEqual({ passive: false })
      res.hit.handlers.touchstart.fn(touch())
      expect(tooltipEl.innerHTML).toContain('Flow Line')
      expect(onOpen).not.toHaveBeenCalled()
      now += 200
      const ev = touch()
      res.hit.handlers.touchstart.fn(ev)
      expect(L.DomEvent.stop).toHaveBeenCalledWith(ev)
      expect(onOpen).toHaveBeenCalledOnce()
    })

    it('taps on different trails of the shared detector do not open', () => {
      const d = detector()
      const a = setup({ doubleTap: { detector: d, id: 's1' } })
      const b = setup({ doubleTap: { detector: d, id: 's2' } })
      a.res.hit.handlers.touchstart.fn(touch())
      now += 100
      b.res.hit.handlers.touchstart.fn(touch())
      expect(a.onOpen).not.toHaveBeenCalled()
      expect(b.onOpen).not.toHaveBeenCalled()
    })

    it('a double tap cancels the pending 3 s hide timer', () => {
      const { res, tooltipEl } = setup({ doubleTap: { detector: detector(), id: 's1' } })
      res.hit.handlers.touchstart.fn(touch())
      now += 100
      res.hit.handlers.touchstart.fn(touch())
      tooltipEl.style.display = 'block'
      vi.advanceTimersByTime(4000)
      expect(tooltipEl.style.display).toBe('block')
    })

    it('a touch cancels a pending mouse hide and resets highlight after 3 s', () => {
      const highlighter = createLineHighlighter()
      const { res, tooltipEl, lines } = setup({ doubleTap: { detector: detector(), id: 's1' }, highlighter, spotId: 's1' })
      const line = lines[0]
      res.hit.handlers.mouseout.fn()
      res.hit.handlers.touchstart.fn(touch())
      vi.advanceTimersByTime(800)
      expect(tooltipEl.style.display).not.toBe('none')
      expect(line.styles.at(-1)).toEqual({ weight: 6, opacity: 1 })
      vi.advanceTimersByTime(2200)
      expect(tooltipEl.style.display).toBe('none')
      expect(line.styles.at(-1)).toEqual({ weight: 4, opacity: 0.85 })
    })
  })

  it('highlights on hover and resets on mouseout', () => {
    const highlighter = createLineHighlighter()
    const { res, lines } = setup({ highlighter, spotId: 's1' })
    res.hit.handlers.mouseover.fn(mouse())
    expect(lines[0].styles.at(-1)).toEqual({ weight: 6, opacity: 1 })
    expect(lines[0].front).toBe(1)
    res.hit.handlers.mouseout.fn()
    expect(lines[0].styles.at(-1)).toEqual({ weight: 4, opacity: 0.85 })
  })
})

describe('createLineHighlighter', () => {
  const mk = () => fakeLine({})
  it('emphasises the target and dims every other registered line, across spots', () => {
    const h = createLineHighlighter()
    const a = mk(), b = mk()
    h.register('s1', a, { weight: 3, opacity: 0.6 })
    h.register('s2', b, { weight: 4, opacity: 0.85 })
    h.highlight(a)
    expect(a.styles.at(-1)).toEqual({ weight: 5, opacity: 1 })
    expect(b.styles.at(-1)).toEqual({ weight: 3, opacity: 0.3 })
  })

  it('defaults a missing weight to 4', () => {
    const h = createLineHighlighter()
    const a = mk(), b = mk()
    h.register('s', a, {}); h.register('s', b, {})
    h.highlight(a)
    expect(a.styles.at(-1).weight).toBe(6)
    expect(b.styles.at(-1).weight).toBe(3)
  })

  it('reset restores the registered style, and clear forgets the lines', () => {
    const h = createLineHighlighter()
    const a = mk()
    h.register('s', a, { weight: 3, opacity: 0.6 })
    h.highlight(a)
    h.reset()
    expect(a.styles.at(-1)).toEqual({ weight: 3, opacity: 0.6 })
    h.clear()
    const before = a.styles.length
    h.highlight(a); h.reset()
    expect(a.styles.length).toBe(before)
  })
})
