#!/usr/bin/env node
// Builds the site exactly as production does (`nuxt generate`) and verifies
// a real trail page renders correctly served as pure static files — no live
// Nitro server, matching the actual production configuration (GitHub Pages +
// Cloudflare Worker). Catches the class of bug where a page depends on
// something (like a server/api route) that only works with a live server:
// see CLAUDE.md's "No live Nitro server in production" and the
// app/architecture.test.ts "No dynamic server/api routes" test, both added
// after this exact failure mode broke production once already.
//
// NOT part of `npm test` or CI on every commit: needs real Supabase
// credentials (.env.local) and takes a few minutes for a full build. Run it
// manually before/after changes to how trail/spot data is fetched, or
// before a production deploy of such a change.
//
// Usage: node scripts/verify-static-build.mjs

import { spawn, spawnSync } from 'node:child_process'
import { readdirSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 4173
const ROOT = fileURLToPath(new URL('..', import.meta.url))

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' })
  if (result.status !== 0) {
    console.error(`✗ ${cmd} ${args.join(' ')} failed`)
    process.exit(1)
  }
}

console.log('→ Building static site (nuxt generate)...')
run('npm', ['run', 'generate'])

const trailsDir = `${ROOT}.output/public/trails`
const ids = existsSync(trailsDir) ? readdirSync(trailsDir).filter(f => !f.includes('.')) : []
if (ids.length === 0) {
  console.error('✗ No prerendered trail pages found in .output/public/trails')
  process.exit(1)
}
const sampleId = ids[0]

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
} finally {
  server.kill()
  rmSync(`${ROOT}.output`, { recursive: true, force: true })
}
process.exit(exitCode)
