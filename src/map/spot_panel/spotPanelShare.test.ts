import { describe, it, expect, vi } from 'vitest'
import { shareTrail, trailShareUrl, type ShareDeps } from './spotPanelShare'

const item = { id: 'trail-1', name: 'Testtrail' }

function makeDeps(overrides: Partial<ShareDeps> = {}): ShareDeps {
  return {
    hasNativeShare: true,
    nativeShare: vi.fn().mockResolvedValue(undefined),
    copyToClipboard: vi.fn().mockResolvedValue(true),
    showToast: vi.fn(),
    reportShare: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('trailShareUrl', () => {
  it('builds the public trail URL from the id', () => {
    expect(trailShareUrl('abc-123')).toBe('https://trailradar.org/trails/abc-123')
  })
})

describe('shareTrail', () => {
  it('uses native share when available and reports the share afterwards', async () => {
    const deps = makeDeps()
    await shareTrail(item, deps)

    expect(deps.nativeShare).toHaveBeenCalledWith({
      title: `Offizieller MTB Trail '${item.name}' auf Trailradar`,
      url: 'https://trailradar.org/trails/trail-1',
    })
    expect(deps.copyToClipboard).not.toHaveBeenCalled()
    expect(deps.showToast).not.toHaveBeenCalled()
    expect(deps.reportShare).toHaveBeenCalledWith('trail-1')
  })

  it('does not report or toast when the user cancels the native share sheet', async () => {
    const deps = makeDeps({ nativeShare: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')) })
    await shareTrail(item, deps)

    expect(deps.reportShare).not.toHaveBeenCalled()
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  // This is the Firefox-desktop path: navigator.share is undefined there.
  it('falls back to clipboard copy + toast when native share is unavailable', async () => {
    const deps = makeDeps({ hasNativeShare: false })
    await shareTrail(item, deps)

    expect(deps.nativeShare).not.toHaveBeenCalled()
    expect(deps.copyToClipboard).toHaveBeenCalledWith('https://trailradar.org/trails/trail-1')
    expect(deps.showToast).toHaveBeenCalledWith('Link kopiert!')
    expect(deps.reportShare).toHaveBeenCalledWith('trail-1')
  })

  it('shows an error toast and skips reporting when clipboard copy also fails', async () => {
    const deps = makeDeps({ hasNativeShare: false, copyToClipboard: vi.fn().mockResolvedValue(false) })
    await shareTrail(item, deps)

    expect(deps.showToast).toHaveBeenCalledWith('Teilen nicht möglich.', 'error')
    expect(deps.reportShare).not.toHaveBeenCalled()
  })
})
