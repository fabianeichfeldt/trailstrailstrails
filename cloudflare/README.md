# Cloudflare Workers

Source-of-truth copies of the Workers that run in front of GitHub Pages (see
`docs/production-architecture.md`). These are **not deployed by CI** — there
is no `wrangler.toml` and no deploy step in `.github/workflows/deploy.yml`.
Deploy manually after any change:

1. Cloudflare dashboard → Workers & Pages → the `_embed` worker → Quick edit,
   paste the file contents in, Save & Deploy.
   (Or `wrangler deploy embed-worker.js` if you have wrangler set up locally.)
2. Verify: `curl 'https://trailradar.org/_embed/<a-real-token>?parentHost=trailradar.org'`
   and check the response shape matches `EmbedTrail` in
   `src/server/routes/_embed/[token].get.ts`.

## Files

- `embed-worker.js` — handles `/_embed/*`. Hand-maintained mirror of
  `src/server/routes/_embed/[token].get.ts` (the Nitro route Nuxt runs live
  during `nuxt dev`, but which never ships to the static `nuxt generate`
  output). **Whenever the Nitro route changes, port the change here and
  redeploy**, or production and local will silently diverge — this is what
  caused the `e.parking is not iterable` production bug (2026-07-31): the
  Nitro route gained a `parking` field, this worker didn't, and it was never
  redeployed.
