/**
 * Converts the Baden-Württemberg "2-Meter-Regel" MTB trail shapefile (EPSG:25832) into GPX
 * and proposes which TrailRadar spot each trail belongs to. Read-only: writes nothing to Supabase.
 *
 *   node --env-file=.env import-bw-2m.js <path/to/file.shp> [radiusKm=10]
 *
 * Output (scripts/backups/bw-2m/<timestamp>/, gitignored):
 *   gpx/*.gpx       one file per trail, WGS84
 *   proposal.json   per trail: candidates within radiusKm, spot_id pre-filled with the nearest
 *   review.md       human-readable version, ambiguous matches first
 */
const fs = require('fs');
const path = require('path');
const { readShp, readDbf, buildGpx, buildProposal, formatReview } = require('./bw-2m-lib');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ixafegmxkadbzhxmepsd.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const SPOT_TABLES = [
  { type: 'trail', table: 'trails', filter: '&visible=eq.true' },
  { type: 'bikepark', table: 'parks', filter: '' },
  { type: 'dirtpark', table: 'dirt_parks', filter: '' },
];
const SOURCE_NOTE = 'Quelle: ForstBW / Land Baden-Württemberg – genehmigte MTB-Trails (2-Meter-Regel)';

async function fetchSpots() {
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const groups = await Promise.all(SPOT_TABLES.map(async ({ type, table, filter }) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id,slug,name,latitude,longitude${filter}`, { headers });
    if (!res.ok) throw new Error(`fetch ${table} failed: ${res.status} ${await res.text()}`);
    return (await res.json()).map(row => ({ ...row, type }));
  }));
  return groups.flat().filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));
}

(async () => {
  const shpPath = process.argv[2];
  const radiusKm = Number(process.argv[3] ?? 10);
  if (!shpPath || !shpPath.endsWith('.shp')) throw new Error('usage: node import-bw-2m.js <file.shp> [radiusKm]');
  if (!KEY) throw new Error('SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY env var is required');

  const base = shpPath.slice(0, -4);
  const prj = fs.existsSync(`${base}.prj`) ? fs.readFileSync(`${base}.prj`, 'utf-8') : '';
  if (!/UTM[_ ]Zone[_ ]32N/i.test(prj)) throw new Error(`expected ETRS89 / UTM zone 32N in ${base}.prj`);
  const encoding = fs.existsSync(`${base}.cpg`) ? fs.readFileSync(`${base}.cpg`, 'utf-8').trim() || 'utf-8' : 'utf-8';

  const shapes = readShp(fs.readFileSync(shpPath));
  const rows = readDbf(fs.readFileSync(`${base}.dbf`), encoding);
  const spots = await fetchSpots();
  console.log(`${shapes.length} trails in shapefile, ${spots.length} spots in TrailRadar`);

  const proposal = buildProposal(shapes, rows, spots, { radiusKm });

  const outDir = path.join(__dirname, 'backups', 'bw-2m', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(path.join(outDir, 'gpx'), { recursive: true });
  for (const t of proposal) {
    fs.writeFileSync(path.join(outDir, 'gpx', t.file), buildGpx(t.name, t.segments, { source: SOURCE_NOTE }));
  }
  const slim = proposal.map(({ segments, ...rest }) => rest);
  fs.writeFileSync(path.join(outDir, 'proposal.json'), JSON.stringify(slim, null, 2));
  fs.writeFileSync(path.join(outDir, 'review.md'), formatReview(proposal, { radiusKm, source: path.basename(shpPath) }));

  const multi = proposal.filter(t => t.candidates.length > 1).length;
  const none = proposal.filter(t => !t.candidates.length).length;
  console.log(`${proposal.length - multi - none} single match, ${multi} ambiguous, ${none} without spot`);
  console.log(`→ ${outDir}`);
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
