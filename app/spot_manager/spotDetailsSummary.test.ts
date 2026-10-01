import { describe, test, expect } from 'vitest'
import { bikeParkBannerSub, bikeParkStatusKey } from './spotDetailsSummary'

const row = (o: object) => ({ id: 'p', status: null, opening_hours: null, trail_description: null, ...o }) as any

describe('bikeParkBannerSub', () => {
  test('no details row -> Nicht konfiguriert', () => {
    expect(bikeParkBannerSub(null)).toBe('Nicht konfiguriert')
  })
  test('open with hours', () => {
    expect(bikeParkBannerSub(row({ status: 'open', opening_hours: 'Mo–So 9–17' }))).toBe('Offen · Mo–So 9–17')
  })
  test('closed without hours', () => {
    expect(bikeParkBannerSub(row({ status: 'closed' }))).toBe('Gesperrt')
  })
  test('long multi-line hours are collapsed and truncated', () => {
    const s = bikeParkBannerSub(row({ status: 'open', opening_hours: 'Mo\nDi '.repeat(30) }))
    expect(s).not.toContain('\n')
    expect(s.length).toBeLessThanOrEqual('Offen · '.length + 40)
    expect(s.endsWith('…')).toBe(true)
  })
})

describe('bikeParkStatusKey', () => {
  test('closed only when closed', () => {
    expect(bikeParkStatusKey(row({ status: 'closed' }))).toBe('closed')
    expect(bikeParkStatusKey(row({ status: 'limited' }))).toBe('open')
    expect(bikeParkStatusKey(null)).toBe('open')
  })
})
