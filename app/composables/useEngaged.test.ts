// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

describe('useEngaged', () => {
  it('turns true when the visit fires engaged, and stops listening with its scope', async () => {
    vi.resetModules()
    const { track } = await import('~/analytics/track')
    const { useEngaged } = await import('./useEngaged')
    const scope = effectScope()
    const engaged = scope.run(() => useEngaged())!
    expect(engaged.value).toBe(false)
    track('like'); track('share')
    expect(engaged.value).toBe(true)
    scope.stop()
  })
})
