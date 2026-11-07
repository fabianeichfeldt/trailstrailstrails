import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { showToast } from './toast'

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = '<div id="toast-container"></div>'
})
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

const toasts = () => Array.from(document.querySelectorAll('#toast-container .toast')) as HTMLElement[]

describe('showToast', () => {
  it('does nothing when there is no toast container', () => {
    document.body.innerHTML = ''
    expect(() => showToast('hi')).not.toThrow()
    expect(document.querySelector('.toast')).toBeNull()
  })

  it('renders the message as a success toast by default', () => {
    showToast('Gespeichert')
    expect(toasts()).toHaveLength(1)
    expect(toasts()[0].textContent).toBe('Gespeichert')
    expect(toasts()[0].classList.contains('toast')).toBe(true)
    expect(toasts()[0].classList.contains('success')).toBe(true)
  })

  it('uses the given type as a class', () => {
    showToast('Fehler', 'error')
    expect(toasts()[0].classList.contains('error')).toBe(true)
  })

  it('shows the toast after the next animation frame', () => {
    showToast('hi')
    expect(toasts()[0].classList.contains('show')).toBe(false)
    vi.advanceTimersByTime(20)
    expect(toasts()[0].classList.contains('show')).toBe(true)
  })

  it('hides after the duration and removes itself once the fade-out ends', () => {
    showToast('hi', 'success', 1000)
    vi.advanceTimersByTime(999)
    expect(toasts()[0].classList.contains('show')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(toasts()[0].classList.contains('show')).toBe(false)
    expect(toasts()).toHaveLength(1)
    vi.advanceTimersByTime(300)
    expect(toasts()).toHaveLength(0)
  })

  it('defaults to a 3 second duration', () => {
    showToast('hi')
    vi.advanceTimersByTime(2999)
    expect(toasts()[0].classList.contains('show')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(toasts()[0].classList.contains('show')).toBe(false)
  })
})
