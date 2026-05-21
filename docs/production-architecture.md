# Production Architecture

## Stack overview

```
Browser
  └── Cloudflare (DNS + CDN + Workers)
        ├── Static assets → GitHub Pages (.output/public)
        ├── /api/*        → Cloudflare Worker  (server/api/* routes)
        ├── /_embed/*     → Cloudflare Worker  (server/routes/_embed/*)
        └── /geo          → Cloudflare Worker  (geolocation helper)
Supabase Cloud  ← directly from browser (REST + Auth)
```

## GitHub Pages

- **Published folder**: `.output/public` (set in `.github/workflows/deploy.yml`)
- Built by `npm run generate` (`nuxt generate`) → fully static SSG
- Branch `feat/nuxt` triggers the build pipeline; deploys via `actions/deploy-pages`

## Cloudflare

Cloudflare sits in front of GitHub Pages and provides:

| Route pattern | Handled by | Notes |
|---|---|---|
| `/*` (fallthrough) | GitHub Pages | Static HTML/JS/CSS |
| `/api/*` | CF Worker | Proxies Nuxt server API routes |
| `/_embed/*` | CF Worker | Token-auth embed data endpoint |
| `/geo` | CF Worker | Returns visitor geolocation |

## Supabase

Accessed **directly from the browser** (no backend proxy). The Supabase project URL and anon key are embedded in the built JS bundle via `NUXT_PUBLIC_SUPABASE_URL` / `NUXT_PUBLIC_SUPABASE_KEY` build env vars. Row-level security enforces access control.

---

## Known constraint: dynamic SSG routes

`nuxt generate` can only pre-render pages with **known URLs at build time**. Pages with dynamic segments (e.g. `[token]`, `[id]`) must either:

- have their IDs fetched during the build hook (see `nitro:config` hook in `nuxt.config.ts` — this is done for trail/park/dirtpark IDs), or
- be served by a server-side handler (Cloudflare Worker) that returns the HTML shell.

### Embed route gap

`pages/embed/[token].vue` is a dynamic route. Embed tokens are created at runtime (not known at build time), so **no `embed/` directory is generated in `.output/public`**. A request to `/embed/<token>` hits GitHub Pages, finds no matching file, and returns a 404.

**Fix**: Cloudflare Worker rule that rewrites `/embed/*` requests to serve `/index.html` from GitHub Pages. The Nuxt SPA shell loads, Vue Router routes client-side to `/embed/[token]`, the component fetches `/_embed/<token>` (handled by the CF Worker), and the map renders.

Alternatively: add a `nitro:close` hook that copies `.output/public/index.html` → `.output/public/404.html`. GitHub Pages serves `404.html` as the fallback for any unmatched path, which lets the SPA handle `/embed/*` client-side. Downside: actual 404s also load the app shell.
