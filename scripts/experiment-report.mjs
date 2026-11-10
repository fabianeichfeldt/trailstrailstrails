#!/usr/bin/env node
// A/B readout from self-hosted Umami. Usage: npm run experiment:report -- [--experiment id] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectReport, parseDate, renderMarkdown } from './experiment-report-lib.mjs';
import { KEYCHAIN_HELP, resolveCredentials } from './umami-credentials.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.UMAMI_URL || 'https://stats.eichfeldt.de';

const USAGE = `Usage: npm run experiment:report -- [options]

  --experiment <id>    experiment id (default: "active" from app/analytics/experiments.json)
  --since YYYY-MM-DD   window start (default: experiment.startedAt)
  --until YYYY-MM-DD   window end, inclusive (default: now)
  --json               machine-readable JSON on stdout
  --help               this text

Credentials: env UMAMI_USERNAME, UMAMI_PASSWORD, UMAMI_WEBSITE_ID; on macOS falls back to
keychain item "trailradar-umami" and \`gh variable get UMAMI_WEBSITE_ID\`.
${KEYCHAIN_HELP}`;

function parseArgs(argv) {
  const opts = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (['--experiment', '--since', '--until'].includes(a)) {
      if (argv[i + 1] === undefined) throw new Error(`${a} needs a value`);
      opts[a.slice(2)] = argv[++i];
    } else throw new Error(`Unknown argument ${a}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return console.log(USAGE);

  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/analytics/experiments.json'), 'utf8'));
  const id = !opts.experiment || opts.experiment === 'active' ? registry.active : opts.experiment;
  const experiment = registry.experiments.find(e => e.id === id);
  if (!experiment) throw new Error(`Experiment "${id}" not found in registry`);
  const sinceStr = opts.since || experiment.startedAt;
  if (!sinceStr) throw new Error(`Experiment "${id}" has no startedAt; pass --since YYYY-MM-DD`);

  const startAt = parseDate(sinceStr);
  const endAt = opts.until ? parseDate(opts.until, true) : Date.now();
  const report = await collectReport({ fetch, baseUrl: BASE_URL, ...resolveCredentials(), experiment, startAt, endAt });

  const md = renderMarkdown(report);
  const dir = path.join(ROOT, 'reports/experiments');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}-${new Date().toISOString().slice(0, 10)}.md`), md);
  console.log(opts.json ? JSON.stringify(report, null, 2) : md);
}

main().catch(err => {
  console.error(`experiment:report: ${err.message}`);
  process.exit(1);
});
