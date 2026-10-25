import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { regions } from './region'

const entries = Object.entries(regions)

describe('region copy', () => {
  test.each(entries)('%s pronom is a well-formed German locative', (_slug, r) => {
    expect(r.pronom).toMatch(/^(in|im|auf|am) /)
  })

  test.each(entries)('%s pronom has no doubled word', (_slug, r) => {
    expect(r.pronom).not.toMatch(/\b(\w+) \1\b/i)
  })

  test('no ASCII-transliterated or misspelled words', () => {
    const bad = ['Koeln', 'Muenchen', 'Duesseldorf', 'Oesterreich', 'Schäwbischen', 'Undebingt']
    const text = entries.map(([, r]) => `${r.pronom} ${r.descr ?? ''}`).join('\n')
    for (const w of bad) expect(text).not.toContain(w)
  })

  test.each(entries)('%s descr has balanced <strong> tags', (_slug, r) => {
    const d = r.descr ?? ''
    expect((d.match(/<strong>/g) ?? []).length).toBe((d.match(/<\/strong>/g) ?? []).length)
  })

  test('no missing space before <strong> after a word', () => {
    const text = entries.map(([, r]) => r.descr ?? '').join('\n')
    expect(text).not.toContain('die<strong>')
  })
})

describe('homepage region links', () => {
  // An unknown slug used to bake an indexable "Nicht gefunden" page (kaernten, regensburg, salzburg).
  test('every /trails/<slug> link on the homepage is a defined region', () => {
    const src = readFileSync('app/pages/index.vue', 'utf8')
    const slugs = [...src.matchAll(/\/trails\/([a-z0-9-]+)/g)].map(m => m[1])
    expect(slugs.length).toBeGreaterThan(0)
    expect(slugs.filter(s => !(s in regions))).toEqual([])
  })
})
