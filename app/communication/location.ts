export async function getApproxLocation(): Promise<{ lat: number; lng: number }> {
  try {
    const res = await fetch('https://trailradar.org/geo')
    if (!res.ok) throw new Error('no geo data')
    const data = await res.json()
    // 0 is a valid coordinate (equator, Greenwich), so only reject non-numbers
    if (Number.isFinite(data.lat) && Number.isFinite(data.lon)) {
      return {
        lat: Math.round(data.lat * 10) / 10,
        lng: Math.round(data.lon * 10) / 10,
      }
    }
  } catch (err) {
    console.error('geo failed', err)
  }
  return { lat: 0, lng: 0 }
}
