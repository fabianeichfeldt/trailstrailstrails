import { describe, it, expect } from 'vitest'
import { canonicalPath, canonicalUrl } from './seo'

describe('canonicalPath', () => {
  it('appends a trailing slash', () => {
    expect(canonicalPath('/about')).toBe('/about/')
    expect(canonicalPath('/trails/allgaeu')).toBe('/trails/allgaeu/')
  })
  it('keeps an existing trailing slash and the root', () => {
    expect(canonicalPath('/about/')).toBe('/about/')
    expect(canonicalPath('/')).toBe('/')
  })
  it('puts the slash before a query or hash', () => {
    expect(canonicalPath('/map?trail=1')).toBe('/map/?trail=1')
    expect(canonicalPath('/faq#rules')).toBe('/faq/#rules')
  })
})

describe('canonicalUrl', () => {
  it('builds an absolute URL with a trailing slash', () => {
    expect(canonicalUrl('/about')).toBe('https://trailradar.org/about/')
    expect(canonicalUrl('/')).toBe('https://trailradar.org/')
    expect(canonicalUrl('trails/x')).toBe('https://trailradar.org/trails/x/')
  })
})
