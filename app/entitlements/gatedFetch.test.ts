import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import type { FeatureAccess } from './features'
import { createGatedFetch, settled, type GatedAdapter, type GatedResponse } from './gatedFetch'

// The adapter's request is the network boundary here; everything else (gate, cache, guards) is real.
interface Card { id: string; v: number }
const request = vi.fn<(token: string, id: string) => Promise<GatedResponse<Card>>>()

const adapter: GatedAdapter<string, Card> = {
  feature: 'trail_condition',
  cachePrefix: 'test_',
  cacheKey: (id) => `test_${id}`,
  request: (token, id) => request(token, id),
  isValid: (v): v is Card => typeof (v as Card)?.id === 'string',
  isFresh: (entry, now) => now - entry.at < 1000,
  offlineFallback: false,
}

const ok = (id: string, v = 1): GatedResponse<Card> => ({ kind: 'ok', data: { id, v } })

let env: { access: FeatureAccess; userId: string }
const getToken = vi.fn()

function make(over: Partial<GatedAdapter<string, Card>> = {}, mount = true) {
  const g = createGatedFetch({ ...adapter, ...over }, {
    access: () => env.access,
    userId: () => env.userId,
    getUserId: async () => env.userId,
    getToken,
  })
  if (mount) g.markMounted()
  return g
}

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  localStorage.clear()
  env = reactive({ access: 'allowed', userId: 'u1' })
  request.mockReset().mockImplementation(async (_t, id) => ok(id))
  getToken.mockReset().mockResolvedValue('jwt')
})

describe('gated fetch — the gate', () => {
  it('says "checking" until mounted, whatever the entitlement — prerendered HTML is the same for everyone', async () => {
    const g = make({}, false)
    expect(g.state.value).toBe('checking')
    expect(await g.load('a')).toBe('superseded')
    expect(request).not.toHaveBeenCalled()

    g.markMounted()
    expect(g.state.value).toBe('idle')
  })

  it('stays "checking" while the entitlement is on its way', () => {
    env.access = 'checking'
    expect(make().state.value).toBe('checking')
  })

  it('never asks the function for a visitor without access', async () => {
    env.access = 'locked'
    const g = make()
    expect(g.state.value).toBe('locked')
    expect(await g.load('a')).toBe('locked')
    expect(request).not.toHaveBeenCalled()
  })

  it('goes idle → loading → ready with the user token', async () => {
    const answer = deferred<GatedResponse<Card>>()
    request.mockReturnValue(answer.promise)
    const g = make()
    const p = g.load('a')
    expect(g.state.value).toBe('loading')
    answer.resolve(ok('a'))
    expect(await p).toBe('ready')
    expect(g.state.value).toBe('ready')
    expect(g.data.value).toEqual({ id: 'a', v: 1 })
    expect(request).toHaveBeenCalledWith('jwt', 'a')
  })

  it('a 403 means locked: data and every cached entry of the feature are gone', async () => {
    const g = make({ isFresh: () => false })
    await g.load('a')
    await g.load('b')
    localStorage.setItem('other_key', 'kept')
    request.mockResolvedValue({ kind: 'forbidden' })

    expect(await g.load('a')).toBe('locked')

    expect(g.state.value).toBe('locked')
    expect(g.data.value).toBeNull()
    expect(localStorage.getItem('test_a')).toBeNull()
    expect(localStorage.getItem('test_b')).toBeNull()
    expect(localStorage.getItem('other_key')).toBe('kept')
  })

  it('a changed entitlement after a 403 gets to ask again', async () => {
    request.mockResolvedValue({ kind: 'forbidden' })
    const g = make()
    await g.load('a')
    env.access = 'checking'
    await nextTick()
    env.access = 'allowed'
    await nextTick()
    expect(g.state.value).toBe('idle')
  })
})

describe('gated fetch — failures', () => {
  it('a failed request ends in "error", never stuck on loading', async () => {
    request.mockResolvedValue({ kind: 'failed' })
    const g = make()
    expect(await g.load('a')).toBe('error')
    expect(g.state.value).toBe('error')
  })

  it('a failing token lookup ends in "error" too', async () => {
    getToken.mockRejectedValue(new Error('no session'))
    const g = make()
    expect(await g.load('a')).toBe('error')
    expect(g.state.value).toBe('error')
  })

  it('serves the expired entry, flagged offline, only when the adapter allows it', async () => {
    const stale = make({ isFresh: () => false, offlineFallback: true })
    await stale.load('a')
    request.mockResolvedValue({ kind: 'failed' })
    expect(await stale.load('a')).toBe('ready')
    expect(stale.offline.value).toBe(true)
    expect(stale.data.value).toEqual({ id: 'a', v: 1 })

    const strict = make({ isFresh: () => false })
    expect(await strict.load('a')).toBe('error')
    expect(strict.data.value).toBeNull()
  })

  it('works when storage throws', async () => {
    const boom = () => { throw new Error('denied') }
    const orig = { get: Storage.prototype.getItem, set: Storage.prototype.setItem }
    Storage.prototype.getItem = boom
    Storage.prototype.setItem = boom
    try {
      expect(await make().load('a')).toBe('ready')
    } finally {
      Storage.prototype.getItem = orig.get
      Storage.prototype.setItem = orig.set
    }
  })
})

describe('gated fetch — cache', () => {
  it('serves a fresh entry without asking, and stamps it with its owner', async () => {
    await make().load('a')
    expect(JSON.parse(localStorage.getItem('test_a')!).uid).toBe('u1')

    const g = make()
    expect(await g.load('a')).toBe('ready')
    expect(request).toHaveBeenCalledOnce()
  })

  it('never serves another user\'s entry, and drops it', async () => {
    await make().load('a')
    env.userId = 'u2'
    await make().load('a')
    expect(request).toHaveBeenCalledTimes(2)
    expect(JSON.parse(localStorage.getItem('test_a')!).uid).toBe('u2')
  })

  it('drops a corrupt entry and asks', async () => {
    localStorage.setItem('test_a', '{oops')
    expect(await make().load('a')).toBe('ready')
    expect(request).toHaveBeenCalledOnce()
  })
})

describe('gated fetch — user change', () => {
  it('sign-out drops the data and sweeps the feature\'s cache', async () => {
    const g = make()
    await g.load('a')
    localStorage.setItem('other_key', 'kept')

    env.userId = ''
    env.access = 'locked'

    expect(g.data.value).toBeNull()
    expect(localStorage.getItem('test_a')).toBeNull()
    expect(localStorage.getItem('other_key')).toBe('kept')
  })

  it('auth resolving on page load (no user → user) keeps the cache', async () => {
    env.userId = ''
    make()
    localStorage.setItem('test_a', JSON.stringify({ uid: 'u1', at: Date.now(), data: { id: 'a', v: 1 } }))
    env.userId = 'u1'
    expect(localStorage.getItem('test_a')).not.toBeNull()
  })
})

describe('gated fetch — stale guard', () => {
  it('a slower answer for the previous params never replaces the current one', async () => {
    const slow = deferred<GatedResponse<Card>>()
    request.mockImplementation(async (_t, id) => (id === 'a' ? slow.promise : ok('b')))
    const g = make()
    const first = g.load('a')
    expect(await g.load('b')).toBe('ready')
    slow.resolve(ok('a'))
    expect(await first).toBe('superseded')
    expect(g.data.value).toEqual({ id: 'b', v: 1 })
  })

  it('an answer that arrives after a sign-out is dropped', async () => {
    const slow = deferred<GatedResponse<Card>>()
    request.mockReturnValue(slow.promise)
    const g = make()
    const p = g.load('a')
    await vi.waitFor(() => expect(request).toHaveBeenCalled())
    env.userId = ''
    slow.resolve(ok('a'))
    expect(await p).toBe('superseded')
    expect(g.data.value).toBeNull()
    expect(localStorage.getItem('test_a')).toBeNull()
  })

  it('switching params clears the previous answer at once', async () => {
    const g = make()
    await g.load('a')
    request.mockReturnValue(new Promise(() => {}))
    void g.load('b')
    expect(g.data.value).toBeNull()
  })
})

describe('settled', () => {
  it('resolves with the first state past "checking"', async () => {
    env.access = 'checking'
    const g = make()
    const p = settled(g.state)
    env.access = 'locked'
    expect(await p).toBe('locked')
  })
})
