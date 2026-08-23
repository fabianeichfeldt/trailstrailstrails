# Folder structure — current state (post Nuxt 4 migration)

> This document originally proposed moving all application source into `src/` under
> Nuxt 3's `srcDir: 'src'`. That migration was completed, then superseded again when
> the project upgraded to Nuxt 4: `src/` was renamed to `app/`, and `public/`/`server/`
> moved to the project root. This document now describes that current, final state.

## Why `app/`, and why `public/`/`server/` moved out

Nuxt 4 changes the *default* resolution root for `public/`, `server/`, `modules/`, and
`shared/` from `srcDir` to `rootDir` — even when `srcDir` is customized. Rather than
fighting the framework with permanent config overrides to keep the old Nuxt 3 layout
(`src/public/`, `src/server/`), the project adopted Nuxt 4's own convention directly:
`srcDir` is `app/` (Nuxt 4's own default name for the source directory), and
`public/`/`server/` are root-level, siblings of `app/` — exactly where Nuxt 4 looks for
them with zero configuration.

The one strict requirement carried over from the original plan: **a single dedicated
folder for source** (`app/`), a single dedicated folder for scripts (`scripts/`), and a
single dedicated folder for docs (`docs/`). Everything else — `public/`, `server/`,
`tests/`, `supabase/`, `build/`, `spotchecks/` — is a recognized top-level convention
folder alongside those three, not "source" in the domain-code sense.

---

## Target structure

```
project-root/
│
├── app/                      ← ALL application source (Nuxt srcDir)
│   ├── app.vue
│   ├── env.d.ts
│   │
│   ├── anon.ts               ← bottom of dep chain
│   ├── types/
│   ├── auth/
│   ├── communication/
│   ├── map/
│   ├── spot_manager/
│   ├── utils/                ← small helper modules
│   │
│   ├── stores/
│   ├── composables/
│   ├── plugins/
│   ├── layouts/
│   ├── pages/
│   ├── components/
│   │
│   ├── assets/                ← Vite-processed static assets
│   │   ├── css/               ← global CSS
│   │   └── icons/              ← SVG icons (vite-svg-loader)
│   │
│   └── css/                  ← CSS for the vanilla-TS map layer
│
├── public/                   ← root-level (Nuxt 4 default) — files copied verbatim to dist
├── server/                   ← root-level (Nuxt 4 default) — Nuxt/Nitro server layer
│   ├── api/
│   ├── routes/
│   └── utils/
│
├── tests/                    ← Playwright E2E tests
├── scripts/                  ← DB/data migration scripts
├── build/                    ← Build-time data helpers for nuxt.config
├── supabase/                 ← Supabase CLI config + migrations
├── spotchecks/               ← Standalone static HTML mini-site
├── docs/                     ← Documentation
├── dist/                     ← Generated build output (gitignored)
├── test-results/             ← Playwright output (gitignored)
│
├── nuxt.config.ts            ← MUST stay at root
├── package.json              ← MUST stay at root
├── tsconfig.json             ← MUST stay at root
├── vitest.config.ts
├── playwright.config.ts
├── .dependency-cruiser.cjs
└── CLAUDE.md
```

---

## Folder-by-folder descriptions

### `app/` — application source root

Everything that is compiled, type-checked, or bundled as part of the app. `srcDir: 'app'`
in `nuxt.config.ts` makes Nuxt look for its convention directories (`pages/`,
`components/`, etc.) here. The `~/` alias points to `srcDir` (`app/`); `@@/` points to
the project root — use `@@/` for anything outside `app/` (e.g. `@@/server/...`,
`@@/build/region`), since `~/server/...` no longer resolves now that `server/` lives at
the root.

**What belongs here:** any `.ts`, `.vue`, `.css`, or `.svg` file that is part of the
running application.
**What does not belong here:** config files, tooling, test runners, scripts, generated
output, and — since the Nuxt 4 migration — `public/` and `server/`.

#### `app/anon.ts`
The single module that holds the Supabase anonymous key. Bottom of the entire dependency
chain — may be imported by anything but imports nothing from the project.

#### `app/types/`
The canonical type system. Discriminated unions (`Trail`, `BikeTrail`, etc.), type
guards, and shared DTO shapes. No imports from any other source layer.

**What belongs:** `Trail.ts`, `TrailDetails.ts`, `Photo.ts`, `MtbTypes.ts`, `VideoDetails.ts`.
**What does not belong:** runtime logic, HTTP calls, Vue-specific types.

#### `app/auth/`
Low-level Supabase authentication operations — the service layer beneath `stores/auth.ts`.
JWT decoding, session management, the `get_my_role()` RPC call. No knowledge of Pinia or Vue.

#### `app/communication/`
The HTTP client layer. Pure functions that talk to Supabase REST and Edge Functions. No
Vue, no Pinia. `http.ts` is the single source of the Supabase URL and auth headers.

**What belongs:** `http.ts`, data-fetching modules (`trails.ts`, `photos.ts`,
`add_spot.ts`, `visit.ts`, `invitations.ts`, etc.), `feedback.ts`.
**What does not belong:** Pinia stores, Vue composables, UI logic, DOM access.

Gold standard to follow: `app/spot_manager/Api.ts`.

#### `app/map/`
The Leaflet map implementation. Pure TypeScript — no Vue imports, no Pinia imports.
Receives dependencies (auth token, trail data) via constructor injection.

**What belongs:** `gpxLayer.ts`, `markerIcon.ts`, `lightbox.ts`, `trailTooltip.ts`,
`spot_panel/`, `detail_popup/`, and their associated `.css` files.
**What does not belong:** Pinia store access, `<script setup>` Vue code, fetch calls.

#### `app/spot_manager/`
Business logic for the privileged SpotManager interface. The API client (`Api.ts`), GPX
processing algorithms (`GpxProcessor.ts`), and the map helper used inside the manager
(`MapView.ts`, `ScrubberCanvas.ts`).

**What does not belong:** Vue components for the SpotManager UI (those live in
`app/components/spotmanager/`).

#### `app/utils/`
Small, stateless helper modules that don't fit any existing subdirectory.

**What belongs:** `formatDate.ts`, `near_by_trails.ts`, `toast.ts`, `locations.ts`.
**What does not belong:** modules with dependencies on communication, map, or stores.

#### `app/assets/`
Static assets processed by Vite.

- `css/` — global CSS loaded via `nuxt.config.ts → css: []`.
- `icons/` — SVG files imported in components via `vite-svg-loader`.
- Images (`*.webp`, `*.jpg`) used in Vue pages/components via `~/assets/...` or direct import.
- `spotchecks/` — images used by the spotchecks mini-site pages.

**What does not belong:** assets that should be served verbatim without processing —
those go in root `public/`.

#### `app/css/`
CSS files owned by the vanilla-TS map layer (`app/map/`). Loaded directly by TypeScript
modules via `import './foo.css'`, not via `nuxt.config.ts`.

#### `app/stores/`
Pinia stores. Each store owns exactly one domain.

**What belongs:** `auth.ts`, `trails.ts`, `filters.ts`, `map.ts`, `spotPanel.ts`.
**What does not belong:** HTTP fetch logic, map/DOM manipulation, non-reactive business logic.

#### `app/composables/`
Vue composables — the orchestration layer wiring together stores, the Leaflet map, and
component events. `useTrailMap.ts` is the only place where Leaflet `L` is instantiated
(inside `onMounted`, client-only).

#### `app/plugins/`
Nuxt plugins — code that runs once during app startup.

**What belongs:** `auth.client.ts`, `pwa-prompt.client.ts`, `visit.client.ts`.

#### `app/layouts/`
Nuxt layouts — the page chrome that wraps route content.

**What belongs:** `default.vue`, `map.vue`, `embed.vue`.

#### `app/pages/`
File-based routing. Every `.vue` file here maps to a URL. Pages are thin: they compose
components and call composables.

#### `app/components/`
Reusable Vue components, auto-imported by Nuxt. Organised by feature: `auth/`, `map/`,
`spotmanager/`. Flat top-level files are app-wide chrome.

---

## What lives at the root (and why)

| Folder / file | Why it's here |
|---|---|
| `public/` | Nuxt 4 resolves `dir.public` relative to `rootDir` by default — this is that default location. Static files served verbatim (manifest, robots.txt, embed.js, icons). |
| `server/` | Nuxt 4 resolves `serverDir` relative to `rootDir` by default (explicitly set to `./server` in `nuxt.config.ts` for clarity even though it now matches the default). The Nuxt/Nitro server layer: `api/` (`*.get.ts`/`*.post.ts` JSON endpoints used by `useFetch` on prerendered pages), `routes/` (non-API routes, e.g. the embed page's `_embed/[token]` handler), `utils/` (server-only helpers). |
| `nuxt.config.ts` | Nuxt requires this at `rootDir` |
| `package.json` | npm / node convention |
| `tsconfig.json` | TypeScript requires this at `rootDir` |
| `vitest.config.ts` | Vitest finds it at root by default |
| `playwright.config.ts` | Playwright finds it at root |
| `.dependency-cruiser.cjs` | Runs from root; paths inside reference the `app/` root-relative locations |
| `build/` | Imported by `nuxt.config.ts` as `./build/region` — must stay beside the config |
| `scripts/` | Operational scripts (DB seeding, data migration), not compiled app code |
| `supabase/` | Supabase CLI expects this at project root |
| `tests/` | Playwright config points here; kept separate from unit tests colocated in `app/` |
| `spotchecks/` | Standalone static HTML mini-site, not part of the Nuxt build |
| `CLAUDE.md` | Project harness — Claude Code reads it at root |
| `CONTEXT.md` | Project context document |

---

## Migration history

1. **Nuxt 3, `src/` migration** (superseded): moved root-level `pages/`, `components/`,
   etc. into `src/` via `srcDir: 'src'`, with `server/` and `public/` explicitly nested
   under `src/server/` and `src/public/` via `serverDir`/implicit-`dir.public` overrides.
2. **Nuxt 4 migration** (current): `src/` renamed to `app/`; `server/` and `public/`
   moved to the project root to match Nuxt 4's new default resolution. Two `~/server/...`
   srcDir-alias imports had to change to the root alias `@@/server/...` since `server/`
   no longer lives under `srcDir`. `app/architecture.test.ts`'s hardcoded path literals
   were updated from `'src/...'` to `'app/...'`.
