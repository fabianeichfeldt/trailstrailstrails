import { describe, test, expect } from 'vitest'
import { parkBannerSub, parkStatusKey } from './spotDetailsSummary'

const row = (o: object) => ({ id: 'p', status: null, opening_hours: null, trail_description: null, ...o }) as any

describe('parkBannerSub', () => {
  test('no details row -> Nicht konfiguriert', () => {
    expect(parkBannerSub(null)).toBe('Nicht konfiguriert')
  })
  test('open with hours', () => {
    expect(parkBannerSub(row({ status: 'open', opening_hours: 'Mo–So 9–17' }))).toBe('Offen · Mo–So 9–17')
  })
  test('closed without hours', () => {
    expect(parkBannerSub(row({ status: 'closed' }))).toBe('Gesperrt')
  })
  test('long multi-line hours are collapsed and truncated', () => {
    const s = parkBannerSub(row({ status: 'open', opening_hours: 'Mo\nDi '.repeat(30) }))
    expect(s).not.toContain('\n')
    expect(s.length).toBeLessThanOrEqual('Offen · '.length + 40)
    expect(s.endsWith('…')).toBe(true)
  })
})

describe('parkStatusKey', () => {
  test('closed only when closed', () => {
    expect(parkStatusKey(row({ status: 'closed' }))).toBe('closed')
    expect(parkStatusKey(row({ status: 'limited' }))).toBe('open')
    expect(parkStatusKey(null)).toBe('open')
  })
})
