import { describe, it, expect } from 'vitest'
import { spotNotFoundPolicy } from './spotNotFound'

describe('spotNotFoundPolicy', () => {
  const base = { isRegion: false, hasSpot: false, isServer: true, isPrerender: true }
  it('fails the prerender with 404 for a missing spot', () => {
    expect(spotNotFoundPolicy(base)).toEqual({ noindex: true, fail404: true })
  })
  it('never throws on the client (post-deploy spots render client-side)', () => {
    expect(spotNotFoundPolicy({ ...base, isServer: false, isPrerender: false })).toEqual({ noindex: true, fail404: false })
  })
  it('does not fail non-prerender SSR', () => {
    expect(spotNotFoundPolicy({ ...base, isPrerender: false }).fail404).toBe(false)
  })
  it('leaves found spots and regions alone', () => {
    expect(spotNotFoundPolicy({ ...base, hasSpot: true })).toEqual({ noindex: false, fail404: false })
    expect(spotNotFoundPolicy({ ...base, isRegion: true })).toEqual({ noindex: false, fail404: false })
  })
})
