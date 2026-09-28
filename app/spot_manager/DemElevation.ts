// DEM elevation lookup via Open Topo Data — used to replace recorded GPX
// altitude (often noisy, e.g. Komoot exports) with terrain-model elevation.
// Public API limits: 100 locations/request, ~1 request/sec, 1000 requests/day.
// See also scripts/backfill-dem-elevation.js, which corrects existing rows.

const DATASET = 'eudem25m'; // EU-DEM, 25m resolution — Europe only
const CHUNK_SIZE = 100;     // Open Topo Data max locations/request
const MIN_REQUEST_GAP_MS = 1100; // stay under ~1 request/sec
const MAX_ATTEMPTS = 3;          // retries a transient failure before giving up
const RETRY_BACKOFF_MS = 1500;   // wait before each retry, on top of the rate-limit gap

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestChunk(latLngs: [number, number][]): Promise<number[]> {
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
  // Open Topo Data returns HTTP 200 / status "OK" with elevation: null for a
  // location outside the dataset's coverage — that's documented behaviour,
  // not an error. Math.round(null) === 0, so letting a null through here
  // would silently corrupt a real trail's altitude to 0 instead of falling
  // back to the recorded GPX altitude. Treat it as a failed chunk instead.
  return data.results.map((r: { elevation: number | null }) => {
    if (typeof r.elevation !== 'number' || !Number.isFinite(r.elevation)) {
      throw new Error('Open Topo Data returned no elevation for a location (outside dataset coverage?)');
    }
    return r.elevation;
  });
}

// Retries a chunk on transient failures (network blip, momentary rate-limit,
// dataset hiccup) before giving up — a single failed request used to kill
// DEM correction for the whole upload with no retry at all.
async function fetchChunk(latLngs: [number, number][]): Promise<number[]> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await requestChunk(latLngs);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BACKOFF_MS);
    }
  }
  throw lastErr;
}

/**
 * Looks up DEM elevation (meters) for each [lat, lng], in the same order as
 * the input. Batches into chunks of 100 and throttles to ~1 request/sec to
 * respect Open Topo Data's public API limits. Retries a failing chunk a
 * couple of times before throwing, so a transient blip doesn't discard DEM
 * correction for the whole upload.
 */
export async function fetchDemElevations(latLngs: [number, number][]): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < latLngs.length; i += CHUNK_SIZE) {
    const chunk = latLngs.slice(i, i + CHUNK_SIZE);
    out.push(...(await fetchChunk(chunk)));
  }
  return out;
}
