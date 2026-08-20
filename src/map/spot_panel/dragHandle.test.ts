import { describe, it, expect, beforeEach } from 'vitest'
import { nearestSnapPoint, initDragHandle } from './dragHandle'

describe('nearestSnapPoint', () => {
  it('resolves values inside the peek band to "peek"', () => {
    expect(nearestSnapPoint(0)).toBe('peek')
    expect(nearestSnapPoint(15)).toBe('peek')
    expect(nearestSnapPoint(25)).toBe('peek')
  })

  it('resolves values inside the half band to "half"', () => {
    expect(nearestSnapPoint(40)).toBe('half')
    expect(nearestSnapPoint(56)).toBe('half')
    expect(nearestSnapPoint(70)).toBe('half')
  })

  it('resolves values inside the full band to "full"', () => {
    expect(nearestSnapPoint(80)).toBe('full')
    expect(nearestSnapPoint(92)).toBe('full')
    expect(nearestSnapPoint(100)).toBe('full')
  })

  it('breaks the exact peek/half midpoint (35.5) toward peek', () => {
    expect(nearestSnapPoint(35.5)).toBe('peek')
  })

  it('breaks the exact half/full midpoint (74) toward half', () => {
    expect(nearestSnapPoint(74)).toBe('half')
  })

  it('resolves just past each midpoint to the other side', () => {
    expect(nearestSnapPoint(35.6)).toBe('half')
    expect(nearestSnapPoint(74.1)).toBe('full')
  })
})

describe('initDragHandle — tap-to-cycle', () => {
  let panel: HTMLDivElement
  let handle: HTMLDivElement

  beforeEach(() => {
    document.body.innerHTML = ''
    // jsdom has no layout engine — pin the viewport so isDesktopViewport()'s
    // >=768 check takes the mobile branch, same as the vertical drag/tap
    // logic under test.
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })

    panel = document.createElement('div')
    panel.className = 'spot-panel'
    panel.style.height = '56vh' // the app's real default open height ("half")
    handle = document.createElement('div')
    handle.className = 'spot-panel-handle'
    panel.appendChild(handle)
    document.body.appendChild(panel)

    // No layout means no real getBoundingClientRect — stub it to derive a
    // height from panel.style.height the way a real computed box would:
    // vh relative to window.innerHeight once settled, or the raw px value
    // doResize() sets live while a drag is in progress.
    panel.getBoundingClientRect = () => {
      const h = panel.style.height
      const heightPx = h.endsWith('vh') ? (parseFloat(h) / 100) * window.innerHeight : parseFloat(h) || 0
      return { height: heightPx } as DOMRect
    }

    initDragHandle(panel)
  })

  function tap(clientY = 300) {
    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 0, clientY }))
  }

  it('a tap with no movement advances to the next fixed stop: half -> full', () => {
    tap()
    expect(panel.style.height).toBe('92vh')
  })

  it('repeated taps cycle the fixed forward order, wrapping past full back to peek', () => {
    tap()
    expect(panel.style.height).toBe('92vh')
    tap()
    expect(panel.style.height).toBe('15vh')
    tap()
    expect(panel.style.height).toBe('56vh')
  })

  it('a real drag past the tap threshold snaps to the nearest stop instead of cycling', () => {
    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 0, clientY: 300 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 120 }))
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: 0, clientY: 120 }))
    expect(panel.style.height).toBe('92vh')
  })
})
