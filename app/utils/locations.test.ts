import { describe, it, expect, vi, beforeEach } from 'vitest'

// Load inside each test: Stryker's per-test coverage only attributes module-level
// evaluation to a test when the import happens in the test body.
async function loadLocations() {
  const mod = await import('./locations')
  return mod.locations
}

beforeEach(() => {
  vi.resetModules()
})

describe('locations', () => {
  it('lists regions with a name and finite coordinates', async () => {
    const locations = await loadLocations()
    expect(locations.length).toBeGreaterThan(30)
    for (const r of locations) {
      expect(r.name).toBeTruthy()
      expect(Number.isFinite(r.lat)).toBe(true)
      expect(Number.isFinite(r.lng)).toBe(true)
    }
  })

  it('keeps every region inside the DACH bounding box', async () => {
    const locations = await loadLocations()
    for (const r of locations) {
      expect(r.lat, r.name).toBeGreaterThan(45)
      expect(r.lat, r.name).toBeLessThan(55)
      expect(r.lng, r.name).toBeGreaterThan(5)
      expect(r.lng, r.name).toBeLessThan(17)
    }
  })

  it('has unique names', async () => {
    const names = (await loadLocations()).map((r) => r.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('resolves Berlin to its city centre', async () => {
    const locations = await loadLocations()
    expect(locations.find((r) => r.name === 'Berlin')).toEqual({ name: 'Berlin', lat: 52.52, lng: 13.405 })
  })
})
