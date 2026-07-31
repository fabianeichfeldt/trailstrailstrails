const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://ixafegmxkadbzhxmepsd.supabase.co';
const service_role_key = process.env.SUPABASE_SERVICE_KEY;
const INPUT_FILE = '../../trail-scraper/trail_analysis.jsonl';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_USER_AGENT = 'TrailRadar-DataImport/1.0';
const GEOCODE_DELAY_MS = 1100; // Nominatim usage policy: max 1 req/sec

// trail_details only applies to "trails", but parking spot_ids can point at
// any spot type — check all three when looking up coords for geocode bias.
const SPOT_TABLES = ['trails', 'parks', 'dirt_parks'];

const geocodeCache = new Map();
const spotCoordsCache = new Map();

if (!service_role_key) {
  throw new Error('SUPABASE_SERVICE_KEY env var is required');
}

function supabaseHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'apikey': service_role_key,
    'Authorization': `Bearer ${service_role_key}`,
    ...extra,
  };
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function hasTrailcrew(spotId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/trailcrew_spots?select=user_id&spot_id=eq.${encodeURIComponent(spotId)}&limit=1`,
    { headers: supabaseHeaders() },
  );
  if (!res.ok) throw new Error(`trailcrew_spots lookup failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows.length > 0;
}

async function upsertTrailDetails(trail) {
  const { name: _name, confidence: _confidence, gps_links: _gpsLinks, parking: _parking, ...fields } = trail;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/trail_details`, {
    method: 'POST',
    headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify(fields),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[${trail.trail_id}] ${trail.name} — trail_details ${response.status}: ${text}`);
  } else {
    console.log(`[${trail.trail_id}] ${trail.name} — trail_details ok`);
  }
}

async function getSpotCoords(spotId) {
  if (spotCoordsCache.has(spotId)) return spotCoordsCache.get(spotId);

  let coords = null;
  for (const table of SPOT_TABLES) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=latitude,longitude&id=eq.${encodeURIComponent(spotId)}&limit=1`,
      { headers: supabaseHeaders() },
    );
    if (!res.ok) continue;
    const rows = await res.json();
    if (rows.length > 0) {
      coords = { lat: rows[0].latitude, lng: rows[0].longitude };
      break;
    }
  }

  spotCoordsCache.set(spotId, coords);
  return coords;
}

async function geocode(query, bias) {
  if (!query) return null;

  const cacheKey = `${query}::${bias ? `${bias.lat},${bias.lng}` : ''}`;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

  const params = new URLSearchParams({ q: query, format: 'json', limit: '1' });
  if (bias) {
    const delta = 0.5; // soft ~50km bias box, not a hard filter
    params.set('viewbox', [
      bias.lng - delta, bias.lat + delta, bias.lng + delta, bias.lat - delta,
    ].join(','));
    params.set('bounded', '0');
  }

  await sleep(GEOCODE_DELAY_MS);
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { 'User-Agent': NOMINATIM_USER_AGENT },
  });

  let match = null;
  if (!res.ok) {
    console.error(`  geocode failed for "${query}": ${res.status}`);
  } else {
    const results = await res.json();
    if (results[0]) match = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  }

  geocodeCache.set(cacheKey, match);
  return match;
}

async function existingParkingNames(spotId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/parking?select=name&spot_id=eq.${encodeURIComponent(spotId)}`,
    { headers: supabaseHeaders() },
  );
  if (!res.ok) return new Set();
  const rows = await res.json();
  return new Set(rows.map(r => r.name));
}

async function insertParking(spotId, name, lat, lng) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/parking`, {
    method: 'POST',
    headers: supabaseHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ spot_id: spotId, name, lat, lng }),
  });

  if (!res.ok) {
    console.error(`  [parking] ${name} — ${res.status}: ${await res.text()}`);
  } else {
    console.log(`  [parking] ${name} — ok`);
  }
}

async function processParking(trail) {
  const items = trail.parking || [];
  if (items.length === 0) return;

  const existingNames = await existingParkingNames(trail.trail_id);

  for (const item of items) {
    const name = item.name || 'Parkplatz';

    if (existingNames.has(name)) {
      console.log(`  [parking] ${name} — already exists, skipping`);
      continue;
    }

    let lat = item.latitude;
    let lng = item.longitude;

    if (lat == null || lng == null) {
      if (item.address) {
        const geocoded = await geocode(item.address);
        if (geocoded) ({ lat, lng } = geocoded);
      } else if (item.name) {
        const bias = await getSpotCoords(trail.trail_id);
        const geocoded = await geocode(item.name, bias);
        if (geocoded) ({ lat, lng } = geocoded);
      }
    }

    if (lat == null || lng == null) {
      console.warn(`  [parking] ${name} — no address/name to geocode or no match found, skipping`);
      continue;
    }

    await insertParking(trail.trail_id, name, lat, lng);
  }
}

(async () => {
  const trails = readJsonl(path.join(__dirname, INPUT_FILE));

  for (const trail of trails) {
    const trailcrewAssigned = await hasTrailcrew(trail.trail_id);

    if (trailcrewAssigned) {
      console.log(`[${trail.trail_id}] ${trail.name} — trailcrew assigned, skipping trail_details`);
    } else {
      await upsertTrailDetails(trail);
    }

    await processParking(trail);
  }
})();
