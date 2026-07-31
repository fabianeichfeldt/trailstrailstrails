const SUPABASE_URL = 'https://ixafegmxkadbzhxmepsd.supabase.co';
const service_role_key = process.env.SUPABASE_SERVICE_KEY;
const REPORT_THRESHOLD_METERS = 2000;
const DELETE_THRESHOLD_METERS = 6000;

const shouldDelete = process.argv.includes('--delete');

// parking.spot_id can point at any spot type.
const SPOT_TABLES = ['trails', 'parks', 'dirt_parks'];

if (!service_role_key) {
  throw new Error('SUPABASE_SERVICE_KEY env var is required');
}

function headers() {
  return {
    'apikey': service_role_key,
    'Authorization': `Bearer ${service_role_key}`,
  };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchAllParking() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/parking?select=id,spot_id,name,lat,lng`, { headers: headers() });
  if (!res.ok) throw new Error(`Fetch parking failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function deleteParking(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/parking?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Delete parking ${id} failed: ${res.status} ${await res.text()}`);
}

async function fetchSpotCoords(spotIds) {
  const coords = new Map();
  for (const table of SPOT_TABLES) {
    const remaining = spotIds.filter(id => !coords.has(id));
    if (remaining.length === 0) break;

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=id,name,latitude,longitude&id=in.(${remaining.join(',')})`,
      { headers: headers() },
    );
    if (!res.ok) continue;

    const rows = await res.json();
    for (const row of rows) {
      coords.set(row.id, { name: row.name, lat: row.latitude, lng: row.longitude });
    }
  }
  return coords;
}

(async () => {
  const parkingRows = await fetchAllParking();
  const spotIds = [...new Set(parkingRows.map(p => p.spot_id))];
  const spotCoords = await fetchSpotCoords(spotIds);

  const flagged = [];
  for (const p of parkingRows) {
    const spot = spotCoords.get(p.spot_id);
    if (!spot) {
      flagged.push({ ...p, spotName: '(spot not found)', distanceM: null });
      continue;
    }
    const distanceM = haversineMeters(p.lat, p.lng, spot.lat, spot.lng);
    if (distanceM > REPORT_THRESHOLD_METERS) {
      flagged.push({ ...p, spotName: spot.name, distanceM });
    }
  }

  flagged.sort((a, b) => (b.distanceM ?? Infinity) - (a.distanceM ?? Infinity));

  console.log(`Found ${flagged.length} parking lot(s) more than ${REPORT_THRESHOLD_METERS / 1000}km from their spot:\n`);
  for (const f of flagged) {
    const distKm = f.distanceM == null ? 'n/a' : (f.distanceM / 1000).toFixed(2);
    console.log(`[${f.spot_id}] ${f.spotName} — parking "${f.name}" (id ${f.id}) — ${distKm} km away (lat ${f.lat}, lng ${f.lng})`);
  }

  const toDelete = flagged.filter(f => f.distanceM != null && f.distanceM > DELETE_THRESHOLD_METERS);

  if (!shouldDelete) {
    if (toDelete.length > 0) {
      console.log(`\n${toDelete.length} of these are more than ${DELETE_THRESHOLD_METERS / 1000}km away and would be deleted with --delete.`);
    }
    return;
  }

  console.log(`\nDeleting ${toDelete.length} parking lot(s) more than ${DELETE_THRESHOLD_METERS / 1000}km from their spot...`);
  for (const f of toDelete) {
    await deleteParking(f.id);
    console.log(`  deleted "${f.name}" (id ${f.id}) — was ${(f.distanceM / 1000).toFixed(2)} km from ${f.spotName}`);
  }
})();
