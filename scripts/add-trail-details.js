/**
 * Imports scraped trail_details (+ parking) from the trail-scraper output.
 *
 *   DRY_RUN=1 node --env-file=.env add-trail-details.js   → writes nothing; review.md lists every field change
 *   node --env-file=.env add-trail-details.js             → applies; changes.jsonl records the before-values
 *   node --env-file=.env revert-trail-details.js <run-dir> → undoes an applied run
 *
 * Each run gets its own folder under scripts/backups/trail-details/ (gitignored).
 * Trailcrew-managed spots are skipped entirely — they are maintained in the SpotManager.
 */
const fs = require('fs');
const path = require('path');
const { createClient, applyDetails, pickDetailFields, formatReview } = require('./trail-details-lib');

const SUPABASE_URL = 'https://ixafegmxkadbzhxmepsd.supabase.co';
const service_role_key = process.env.SUPABASE_SERVICE_KEY;
const INPUT_FILE = process.env.TRAIL_DETAILS_INPUT || path.join(__dirname, '../../trail-scraper/trail_analysis.jsonl');
const DRY_RUN = process.env.DRY_RUN === '1';

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

const client = createClient({ url: SUPABASE_URL, key: service_role_key });

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

// Returns the names that would be / were added; real runs push the new row ids into entry.parking_ids.
async function processParking(trail, entry) {
  const items = trail.parking || [];
  const added = [];
  if (items.length === 0) return added;

  const existingNames = await client.parkingNames(trail.trail_id);

  for (const item of items) {
    const name = item.name || 'Parkplatz';
    if (existingNames.has(name)) continue;

    if (DRY_RUN) {
      // Geocoding is skipped in dry runs (1 req/s Nominatim limit); the name is enough to review.
      const hasCoords = item.latitude != null && item.longitude != null;
      added.push(hasCoords ? name : `${name} (coords via geocoding: ${item.address || item.name || '—'})`);
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

    try {
      entry.parking_ids.push(await client.insertParking({ spot_id: trail.trail_id, name, lat, lng }));
      added.push(name);
      console.log(`  [parking] ${name} — ok`);
    } catch (err) {
      console.error(`  [parking] ${name} — ${err.message}`);
    }
  }
  return added;
}

(async () => {
  const trails = readJsonl(INPUT_FILE);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = path.join(__dirname, 'backups', 'trail-details', `${stamp}${DRY_RUN ? '-dry' : ''}`);
  fs.mkdirSync(runDir, { recursive: true });
  const logFile = path.join(runDir, 'changes.jsonl');

  const dropped = new Set(trails.flatMap(t => pickDetailFields(t).dropped));
  console.log(`${DRY_RUN ? 'DRY RUN — nothing is written. ' : ''}${trails.length} spots → ${runDir}`);
  console.log(`Ignored input keys (no trail_details column): ${[...dropped].join(', ')}\n`);

  const entries = [];
  for (const trail of trails) {
    let entry;
    try {
      entry = await applyDetails(client, trail, { dryRun: DRY_RUN });
    } catch (err) {
      entry = { trail_id: trail.trail_id, name: trail.name, action: 'error', error: err.message };
    }

    if (entry.action !== 'skipped_trailcrew' && entry.action !== 'error') {
      entry.parking_ids ??= [];
      entry.parking = await processParking(trail, entry);
    }

    const fields = Object.keys(entry.changes ?? {});
    console.log(`[${entry.trail_id}] ${entry.name} — ${entry.action}${fields.length ? `: ${fields.join(', ')}` : ''}${entry.parking?.length ? ` (+${entry.parking.length} parking)` : ''}${entry.error ? ` — ${entry.error}` : ''}`);

    entries.push(entry);
    // Appended per spot so a crashed run still leaves a complete undo log for everything written so far.
    if (!DRY_RUN && (entry.changes || entry.parking_ids?.length)) fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  }

  const title = `trail_details ${DRY_RUN ? 'dry run' : 'import'} ${stamp}`;
  fs.writeFileSync(path.join(runDir, 'review.md'), formatReview(entries, { title }));
  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(entries, null, 2));

  console.log(`\nReview: ${path.join(runDir, 'review.md')}`);
  if (!DRY_RUN) console.log(`Undo:   npm run revert-trail-details -- ${runDir}`);
})();
