#!/usr/bin/env node
// Verifies a real trail page renders correctly served as pure static files —
// no live Nitro server, matching the actual production configuration
// (GitHub Pages + Cloudflare Worker). Catches the class of bug where a page
// depends on something (like a server/api route) that only works with a
// live server: see CLAUDE.md's "No live Nitro server in production" and the
// app/architecture.test.ts "No dynamic server/api routes" test, both added
// after this exact failure mode broke production once already.
//
// Runs in CI as part of the `build` job in .github/workflows/deploy.yml,
// right after `nuxt generate` and before the static output is uploaded for
// deploy — a failure here blocks the deploy. Needs real Supabase credentials
// (committed .env.local — the anon key is meant to be public, see CLAUDE.md's
// Supabase rules) to find a real, actually-prerendered trail id to check.
//
// Usage:
//   node scripts/verify-static-build.mjs               # build then verify (local, one-shot)
//   node scripts/verify-static-build.mjs --skip-build   # verify an already-built .output/public (CI)

import { spawn, spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4173
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const skipBuild = process.argv.includes('--skip-build')

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`✗ ${cmd} ${args.join(' ')} failed`)
    process.exit(1)
  }
}

if (!skipBuild) {
  console.log('→ Building static site (nuxt generate)...')
  run('npm', ['run', 'generate'])
}

const trailsDir = `${ROOT}.output/public/trails`
const candidates = existsSync(trailsDir) ? readdirSync(trailsDir).filter(f => !f.includes('.')) : []
// Skip the legacy-URL redirect stubs (id/retired-slug dirs whose index.html is
// just a canonical + meta-refresh to the real /trails/<slug>/ page) — pick a
// real prerendered page, identified by the Nuxt app root.
const ids = candidates.filter(f => {
  try {
    return readFileSync(`${trailsDir}/${f}/index.html`, 'utf8').includes('id="__nuxt"')
  } catch {
    return false
  }
})
if (ids.length === 0) {
  console.error('✗ No prerendered trail pages found in .output/public/trails')
  process.exit(1)
}
const sampleId = ids[0]

// A legacy-URL redirect stub: an id/retired-slug dir whose index.html is a
// canonical + meta-refresh to the real /trails/<slug>/ page (see the
// prerender:done hook in nuxt.config.ts). Its presence is what keeps old
// /trails/<uuid>/ links alive after the id→slug switch.
const stubId = candidates.find(f => {
  try {
    return readFileSync(`${trailsDir}/${f}/index.html`, 'utf8').includes('http-equiv="refresh"')
  } catch {
    return false
  }
})

console.log(`→ Serving .output/public and checking /trails/${sampleId} ...`)
const server = spawn('npx', ['serve', '-l', String(PORT), '.output/public'], { cwd: ROOT, stdio: 'ignore' })

let exitCode = 0
try {
  await sleep(3000)
  const res = await fetch(`http://localhost:${PORT}/trails/${sampleId}`)
  const body = await res.text()

  const failures = []
  if (res.status !== 200) failures.push(`expected HTTP 200, got ${res.status}`)
  if (body.includes('Nicht gefunden')) failures.push('page rendered the "Nicht gefunden" fallback instead of trail content')
  if (!/<h1[^>]*>[^<]+<\/h1>/.test(body)) failures.push('no <h1> with content found')

  if (failures.length) {
    console.error('✗ Static build verification FAILED:')
    for (const f of failures) console.error(`  - ${f}`)
    exitCode = 1
  } else {
    console.log(`✓ /trails/${sampleId} rendered correctly from a pure static server (no live API)`)
  }

  // Legacy-URL redirect stub: 200, points at a real /trails/<slug>/ page.
  if (!stubId) {
    console.error('✗ No legacy-URL redirect stub found in .output/public/trails')
    exitCode = 1
  } else {
    const stubRes = await fetch(`http://localhost:${PORT}/trails/${stubId}`, { redirect: 'manual' })
    const stubBody = await stubRes.text()
    const target = stubBody.match(/http-equiv="refresh" content="0; url=(\/trails\/[^"]+\/)"/)?.[1]
    const stubFailures = []
    if (stubRes.status !== 200) stubFailures.push(`stub expected HTTP 200, got ${stubRes.status}`)
    if (!target) stubFailures.push('stub has no meta-refresh to a /trails/<slug>/ URL')
    if (target && !stubBody.includes(`<link rel="canonical" href="https://trailradar.org${target}">`)) {
      stubFailures.push('stub canonical does not match its redirect target')
    }
    if (target && !ids.includes(target.replace(/^\/trails\/|\/$/g, ''))) {
      stubFailures.push(`stub redirects to ${target} which is not a real prerendered page`)
    }
    if (stubFailures.length) {
      console.error('✗ Redirect-stub verification FAILED:')
      for (const f of stubFailures) console.error(`  - ${f}`)
      exitCode = 1
    } else {
      console.log(`✓ /trails/${stubId} is a redirect stub → ${target} (a real page)`)
    }
  }
} finally {
  server.kill()
  // Only clean up .output when this script built it itself (local, one-shot
  // usage) — in CI it must survive for the upload-pages-artifact step.
  if (!skipBuild) rmSync(`${ROOT}.output`, { recursive: true, force: true })
}
process.exit(exitCode)
