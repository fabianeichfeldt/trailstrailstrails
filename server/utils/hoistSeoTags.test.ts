import { describe, it, expect } from 'vitest'
import { hoistSeoTags, seoTagRank } from './hoistSeoTags'

// Mirrors the real prerendered <head> shape: charset/viewport/title first,
// then ~28KB of inlined <style>, then the OpenGraph/Twitter tags from
// useSeoMeta — which is what pushes them past WhatsApp's fetch budget.
const bigStyle = `<style>${'.x{color:red}'.repeat(2000)}</style>`
const realisticHead = [
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>MTB Trails Burgkunstadt - Trailradar</title>',
  bigStyle,
  '<link rel="stylesheet" href="/_nuxt/entry.css">',
  '<meta name="theme-color" content="#1b4332">',
  '<meta property="og:image" content="https://trailradar.org/assets/og-default.jpg">',
  '<meta property="og:image:width" content="1200">',
  '<meta name="description" content="Acht legale MTB-Trails im Stadtwald Burgkunstadt.">',
  '<meta property="og:title" content="MTB Trails Burgkunstadt - Trailradar">',
  '<meta property="og:description" content="Acht legale MTB-Trails im Stadtwald Burgkunstadt.">',
  '<meta property="og:url" content="https://trailradar.org/trails/x/">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:title" content="MTB Trails Burgkunstadt - Trailradar">',
  '<link rel="canonical" href="https://trailradar.org/trails/x/">',
]

describe('hoistSeoTags', () => {
  it('moves title, description, og:* and twitter:* ahead of the style blocks', () => {
    const [out] = hoistSeoTags(realisticHead)

    const stylePos = out.indexOf('<style>')
    for (const needle of [
      '<title>',
      '<meta name="description"',
      '<meta property="og:title"',
      '<meta property="og:description"',
      '<meta property="og:image"',
      '<meta name="twitter:card"',
      '<link rel="canonical"',
    ]) {
      expect(out.indexOf(needle), needle).toBeGreaterThan(-1)
      expect(out.indexOf(needle), `${needle} before <style>`).toBeLessThan(stylePos)
    }
  })

  it('keeps the WhatsApp-critical tags within the first 8KB', () => {
    const [out] = hoistSeoTags(realisticHead)
    const firstSlice = out.slice(0, 8192)
    expect(firstSlice).toContain('<meta property="og:title"')
    expect(firstSlice).toContain('<meta property="og:description"')
    expect(firstSlice).toContain('<meta property="og:image"')
    expect(firstSlice).toContain('<meta name="description"')
  })

  it('orders charset then viewport then title first', () => {
    const [out] = hoistSeoTags(realisticHead)
    expect(out.indexOf('charset')).toBeLessThan(out.indexOf('name="viewport"'))
    expect(out.indexOf('name="viewport"')).toBeLessThan(out.indexOf('<title>'))
    expect(out.indexOf('<title>')).toBeLessThan(out.indexOf('og:title'))
  })

  it('preserves every hoisted tag exactly once and leaves the styles intact', () => {
    const [out] = hoistSeoTags(realisticHead)
    expect(out.match(/<meta property="og:title"/g)).toHaveLength(1)
    expect(out.match(/<title>/g)).toHaveLength(1)
    expect(out).toContain(bigStyle)
    expect(out).toContain('<link rel="stylesheet" href="/_nuxt/entry.css">')
    expect(out).toContain('<meta name="theme-color" content="#1b4332">')
  })

  it('is a no-op (same array reference semantics) when there is nothing to hoist', () => {
    const plain = ['<meta name="theme-color" content="#000">', '<style>.a{}</style>']
    expect(hoistSeoTags(plain)).toBe(plain)
  })

  it('ranks unknown tags after all known ones', () => {
    expect(seoTagRank('<meta name="theme-color" content="#000">')).toBe(Infinity)
    expect(seoTagRank('<meta property="og:title" content="x">')).toBeLessThan(
      seoTagRank('<meta property="og:site_name" content="x">'),
    )
  })
})
