#!/usr/bin/env node
// Usage: node build-overview.mjs <manifest.json> <out.html>
// Manifest: [{route, title, note, before?: png, after: [{label, png}]}]. Node builtins only (macOS `sips` used to shrink images if present).
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [manifestPath, outPath] = process.argv.slice(2)
if (!manifestPath || !outPath) { console.error('usage: build-overview.mjs <manifest.json> <out.html>'); process.exit(1) }
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (!Array.isArray(manifest)) { console.error('manifest must be an array'); process.exit(1) }

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const git = args => { try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' } }
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown'
const date = new Date().toISOString().slice(0, 10)
const e2e = process.env.UI_SUMMARY_E2E || 'E2E: not run'

const tmp = mkdtempSync(join(tmpdir(), 'ui-summary-'))
let n = 0
function embed(png) {
  if (!existsSync(png)) return null
  let file = png, mime = 'image/png'
  const out = join(tmp, `${n++}.jpg`)
  try { // max 1280px wide, JPEG q70; falls back to the original where sips is unavailable
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '70', '--resampleWidth', '1280', png, '--out', out], { stdio: 'ignore' })
    file = out; mime = 'image/jpeg'
  } catch { /* keep original */ }
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`
}
const img = (png, label) => {
  const src = embed(png)
  return src ? `<figure><img src="${src}" alt="${esc(label)}" loading="lazy"><figcaption>${esc(label)}</figcaption></figure>`
    : `<figure class="missing"><figcaption>${esc(label)}: screenshot missing</figcaption></figure>`
}

const sections = manifest.map(m => {
  const after = (m.after || []).map(a => img(a.png, a.label))
  return `<section><h2>${esc(m.title || m.route)} <code>${esc(m.route)}</code></h2>
${m.note ? `<p class="note">${esc(m.note)}</p>` : ''}
<div class="grid">${m.before ? `<div class="col"><h3>Before</h3>${img(m.before, 'before')}</div>` : ''}<div class="col"><h3>After</h3><div class="shots">${after.join('')}</div></div></div></section>`
}).join('\n')

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>UI overview ${esc(branch)}</title>
<style>
:root{--bg:#fafaf7;--fg:#1c1c19;--muted:#6b6b63;--card:#fff;--line:#e2e2da;--accent:#2f6b3f}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#151714;--fg:#ece8e6;--muted:#9a9a90;--card:#1e211d;--line:#33372f;--accent:#7fc58f}}
:root[data-theme="dark"]{--bg:#151714;--fg:#ece8e6;--muted:#9a9a90;--card:#1e211d;--line:#33372f;--accent:#7fc58f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px}
header{border-bottom:1px solid var(--line);margin-bottom:24px;padding-bottom:12px}
h1{margin:0 0 4px;font-size:1.5rem}.meta{color:var(--muted);font-size:.9rem}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:24px}
h2{margin:0 0 8px;font-size:1.15rem}h3{margin:0 0 8px;font-size:.85rem;text-transform:uppercase;letter-spacing:.05em;color:var(--accent)}
code{font-size:.85rem;color:var(--muted);background:var(--bg);padding:1px 6px;border-radius:6px}
.note{color:var(--muted);margin:0 0 12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.grid>.col:only-child{grid-column:1/-1}
.shots{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}
figure{margin:0;flex:1 1 200px;min-width:0}figure img{width:100%;height:auto;border:1px solid var(--line);border-radius:8px;display:block}
figcaption{font-size:.8rem;color:var(--muted);margin-top:4px}.missing{border:1px dashed var(--line);padding:12px;border-radius:8px}
@media (max-width:720px){.grid{grid-template-columns:1fr}}
</style></head><body><main>
<header><h1>UI overview</h1><div class="meta">Branch <code>${esc(branch)}</code> · ${date} · ${esc(e2e)}</div></header>
${sections || '<p>No affected routes.</p>'}
</main></body></html>`

rmSync(tmp, { recursive: true, force: true })
writeFileSync(outPath, html)
const mb = Buffer.byteLength(html) / 1048576
console.log(`wrote ${outPath} (${mb.toFixed(2)} MB)`)
if (mb > 8) console.warn('WARNING: over 8MB; use fewer or smaller screenshots')
