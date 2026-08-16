// DEM elevation lookup via Open Topo Data — used to replace recorded GPX
// altitude (often noisy, e.g. Komoot exports) with terrain-model elevation.
// Public API limits: 100 locations/request, ~1 request/sec, 1000 requests/day.
// See also scripts/backfill-dem-elevation.js, which corrects existing rows.

const DATASET = 'eudem25m'; // EU-DEM, 25m resolution — Europe only
const CHUNK_SIZE = 100;     // Open Topo Data max locations/request
const MIN_REQUEST_GAP_MS = 1100; // stay under ~1 request/sec

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchChunk(latLngs: [number, number][]): Promise<number[]> {
  const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const locations = latLngs.map(([lat, lng]) => `${lat},${lng}`).join('|');
  const res = await fetch(`https://api.opentopodata.org/v1/${DATASET}?locations=${locations}`);
  if (!res.ok) {
    throw new Error(`Open Topo Data request failed (${res.status})`);
  }
  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error(`Open Topo Data error: ${JSON.stringify(data)}`);
  }
  return data.results.map((r: { elevation: number }) => r.elevation);
}

/**
 * Looks up DEM elevation (meters) for each [lat, lng], in the same order as
 * the input. Batches into chunks of 100 and throttles to ~1 request/sec to
 * respect Open Topo Data's public API limits.
 */
export async function fetchDemElevations(latLngs: [number, number][]): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < latLngs.length; i += CHUNK_SIZE) {
    const chunk = latLngs.slice(i, i + CHUNK_SIZE);
    out.push(...(await fetchChunk(chunk)));
  }
  return out;
}
