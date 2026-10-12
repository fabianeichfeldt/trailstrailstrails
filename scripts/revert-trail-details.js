/**
 * Undoes an applied add-trail-details.js run from its changes.jsonl.
 *
 *   node --env-file=.env revert-trail-details.js <run-dir>            → reverts
 *   DRY_RUN=1 node --env-file=.env revert-trail-details.js <run-dir>  → only prints what it would do
 *   ... revert-trail-details.js <run-dir> --force                     → also reverts spots edited since the import
 *   ... revert-trail-details.js <run-dir> --only=<trail_id>,<trail_id>
 *
 * Updated spots get their previous field values back, created rows are deleted, inserted parking is deleted.
 * A spot whose imported fields were changed again afterwards (e.g. in the SpotManager) is skipped unless --force.
 */
const fs = require('fs');
const path = require('path');
const { createClient, revertEntry } = require('./trail-details-lib');

const SUPABASE_URL = 'https://ixafegmxkadbzhxmepsd.supabase.co';
const service_role_key = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

const args = process.argv.slice(2);
const runDir = args.find(a => !a.startsWith('--'));
const force = args.includes('--force');
const only = args.find(a => a.startsWith('--only='))?.slice('--only='.length).split(',');

if (!service_role_key) throw new Error('SUPABASE_SERVICE_KEY env var is required');
if (!runDir) throw new Error('usage: revert-trail-details.js <run-dir> [--force] [--only=id,id]');

const logFile = path.join(path.resolve(runDir), 'changes.jsonl');
if (!fs.existsSync(logFile)) throw new Error(`${logFile} not found — dry runs have nothing to revert`);

const client = createClient({ url: SUPABASE_URL, key: service_role_key });

(async () => {
  const entries = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    .filter(e => !only || only.includes(e.trail_id));
  console.log(`${DRY_RUN ? 'DRY RUN — ' : ''}reverting ${entries.length} spots from ${logFile}\n`);

  let reverted = 0, skipped = 0, failed = 0;
  for (const entry of entries) {
    try {
      const result = await revertEntry(client, entry, { dryRun: DRY_RUN, force });
      if (result.skipped) {
        skipped++;
        console.warn(`[${entry.trail_id}] ${entry.name} — SKIPPED, changed since import:`);
        result.conflicts.forEach(c => console.warn(`    ${c}`));
        continue;
      }
      reverted++;
      console.log(`[${entry.trail_id}] ${entry.name} — ${result.steps.join('; ') || 'nothing to do'}`);
      result.conflicts.forEach(c => console.warn(`    forced over: ${c}`));
    } catch (err) {
      failed++;
      console.error(`[${entry.trail_id}] ${entry.name} — ${err.message}`);
    }
  }

  console.log(`\n${reverted} reverted, ${skipped} skipped (use --force), ${failed} failed`);
  if (failed) process.exitCode = 1;
})();
