import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchStaticJsonOnce, resetStaticJsonCache } from './staticJson'

afterEach(() => { resetStaticJsonCache(); vi.unstubAllGlobals() })

describe('fetchStaticJsonOnce', () => {
  it('requests a URL once across repeated calls', async () => {
    const f = vi.fn().mockResolvedValue({ a: 1 })
    vi.stubGlobal('$fetch', f)
    const [x, y] = await Promise.all([fetchStaticJsonOnce('/nearby.json'), fetchStaticJsonOnce('/nearby.json')])
    await fetchStaticJsonOnce('/nearby.json')
    expect(f).toHaveBeenCalledOnce()
    expect(x).toBe(y)
  })

  it('retries after a failure', async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true })
    vi.stubGlobal('$fetch', f)
    await expect(fetchStaticJsonOnce('/regions.json')).rejects.toThrow('offline')
    await expect(fetchStaticJsonOnce('/regions.json')).resolves.toEqual({ ok: true })
    expect(f).toHaveBeenCalledTimes(2)
  })
})
