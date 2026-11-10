#!/usr/bin/env node
// Daily traffic readout from self-hosted Umami. Usage: npm run daily:report -- [--date YYYY-MM-DD] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDailyReport, isIsoDay, renderDailyMarkdown, yesterdayInBerlin } from './daily-report-lib.mjs';
import { KEYCHAIN_HELP, resolveCredentials } from './umami-credentials.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.UMAMI_URL || 'https://stats.eichfeldt.de';

const USAGE = `Usage: npm run daily:report -- [options]

  --date YYYY-MM-DD    report day (default: yesterday in Europe/Berlin)
  --json               machine-readable JSON on stdout
  --help               this text

Writes the markdown to reports/daily/<date>.md.
Credentials: env UMAMI_USERNAME, UMAMI_PASSWORD, UMAMI_WEBSITE_ID; on macOS falls back to
keychain item "trailradar-umami" and \`gh variable get UMAMI_WEBSITE_ID\`.
${KEYCHAIN_HELP}`;

function parseArgs(argv) {
  const opts = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--date') {
      if (argv[i + 1] === undefined) throw new Error('--date needs a value');
      opts.date = argv[++i];
    } else throw new Error(`Unknown argument ${a}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return console.log(USAGE);

  const day = opts.date ?? yesterdayInBerlin();
  if (!isIsoDay(day)) throw new Error(`Invalid date "${day}", expected YYYY-MM-DD`);
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/analytics/experiments.json'), 'utf8'));

  const report = await collectDailyReport({ fetch, baseUrl: BASE_URL, ...resolveCredentials(), day, registry });

  const md = renderDailyMarkdown(report);
  const dir = path.join(ROOT, 'reports/daily');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${day}.md`), md);
  console.log(opts.json ? JSON.stringify(report, null, 2) : md);
}

main().catch(err => {
  console.error(`daily:report: ${err.message}`);
  process.exit(1);
});
