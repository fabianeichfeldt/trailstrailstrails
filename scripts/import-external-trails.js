/**
 * Imports a trail-scraper import.json into public.spot_gpx_trails. Dry run unless --apply.
 *
 *   node --env-file=.env import-external-trails.js <path/to/import.json> [--apply]
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY (service role; bypasses RLS).
 */
const { runImport, formatReport } = require('./external-import-lib');

(async () => {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const importPath = args.find(a => !a.startsWith('--'));
  if (!importPath) throw new Error('usage: node import-external-trails.js <import.json> [--apply]');
  const supabaseUrl = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl) throw new Error('Missing env: SUPABASE_URL');
  if (!serviceKey) throw new Error('Missing env: SUPABASE_SERVICE_KEY');
  const report = await runImport(require('path').resolve(importPath), { apply, supabaseUrl, serviceKey });
  console.log(formatReport(report));
  if (report.failed.length) process.exit(1);
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
