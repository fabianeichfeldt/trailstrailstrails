# PWA Offline Mode — Subscription Gate

**Date:** 2026-06-27  
**Status:** Approved

## Summary

Gate the PWA offline cache behind a paid subscription (Creem.io). Subscribed users get full offline access to map tiles, trail/park/dirtpark markers, GPX tracks, and trail detail pages. Non-subscribers see a branded offline splash page with a subscribe CTA when they open the app without a network connection.

Cache population is **passive** — data caches naturally as users browse online. No proactive prefetch.

---

## Architecture

Five new or changed pieces:

| File | Role |
|---|---|
| `src/sw.ts` | Custom SW — Workbox precaching + runtime routing + offline gate |
| `src/communication/subscription.ts` | Fetch subscription status from `user_subscriptions` Supabase table |
| `stores/auth.ts` | Add `isSubscribed` ref (written by bridge plugin, exposed to app) |
| `plugins/subscription-bridge.client.ts` | Writes subscription flag to IndexedDB when auth state changes |
| `pages/offline.vue` | Offline splash page for non-subscribers |

### Data flow

```
App boots (online)
  → auth store loads
  → subscription-bridge fetches user_subscriptions
  → writes { subscribed, userId, validUntil } to IndexedDB[trailradar-sw/config/subscription]

User goes offline
  → SW fetch handler tries network → fails
  → SW reads IndexedDB subscription flag
  → subscribed: true  → serve matching Workbox cache entry
  → subscribed: false
      navigation request → return precached /offline page
      data/API request   → return 503 JSON { error: 'offline-subscription-required' }
```

The gate only fires on network failure — online users always hit the network regardless of subscription status.

---

## IndexedDB Bridge

- **DB name:** `trailradar-sw`, version 1  
- **Object store:** `config`  
- **Entry shape:**
  ```ts
  {
    key: 'subscription',
    subscribed: boolean,
    userId: string,
    validUntil: string | null  // ISO date string from user_subscriptions.ends_at
  }
  ```

`validUntil` allows the SW to enforce expiry client-side when offline — if `ends_at` is in the past, treat as unsubscribed without a network call.

**`plugins/subscription-bridge.client.ts`** responsibilities:
1. Run once on app init (handles reload while already logged in)
2. Watch `authStore.isLoggedIn` reactively
3. On login → fetch `user_subscriptions`, write flag
4. On logout → write `{ subscribed: false, userId: '', validUntil: null }`

The plugin owns all IndexedDB writes. The SW only reads.

---

## Service Worker (`src/sw.ts`)

### Strategy switch

`nuxt.config.ts` switches from `generateSW` (default) to `injectManifest`:

```ts
pwa: {
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
}
```

Vite-PWA compiles `src/sw.ts` and injects `self.__WB_MANIFEST` (the precache manifest) at build time.

### SW structure

**Layer 1 — Precaching:**  
`precacheAndRoute(self.__WB_MANIFEST)` handles all static assets and the `/offline` page (explicitly added to `additionalManifestEntries`).

**Layer 2 — Runtime caching:**  
All rules from the current `nuxt.config.ts` `runtimeCaching` array rewritten as `registerRoute()` calls with the same strategies, cache names, entry limits, and TTLs. No behaviour change.

| Cache | Pattern | Strategy | Entries | TTL |
|---|---|---|---|---|
| `osm-tiles` | `[abc].tile.openstreetmap.org/*` | CacheFirst | 500 | 30d |
| `supabase-rest-trails` | `*.supabase.co/rest/v1/trails*` | NetworkFirst | 200 | 24h |
| `supabase-rest-parks` | `*.supabase.co/rest/v1/parks*` | NetworkFirst | 200 | 24h |
| `supabase-rest-dirtparks` | `*.supabase.co/rest/v1/dirt_parks*` | NetworkFirst | 200 | 24h |
| `supabase-rest-gpx` | `*.supabase.co/rest/v1/spot_gpx_*` | NetworkFirst | 200 | 7d |
| `supabase-functions` | `*.supabase.co/functions/v1/*-details*` | NetworkFirst | 100 | 24h |
| `nuxt-api` | `/api/trails`, `/api/trail/*` | NetworkFirst | 200 | 24h |
| `trail-photos` | `*.supabase.co/storage/.../trail-photos/*` | CacheFirst | 100 | 7d |

**Layer 3 — Offline gate (`setCatchHandler`):**  
Fires when any registered route's network fetch fails. Single place for all offline logic:

```ts
async function readSubscriptionFlag(): Promise<{ subscribed: boolean; validUntil: string | null }> {
  // open IndexedDB 'trailradar-sw', read config/subscription
  // return { subscribed: false, validUntil: null } on any error
}

setCatchHandler(async ({ request }) => {
  const flag = await readSubscriptionFlag()
  const now = new Date().toISOString()
  const subscribed = flag.subscribed && (!flag.validUntil || flag.validUntil > now)

  if (subscribed) {
    // try to serve from whichever cache holds this URL
    const cached = await caches.match(request)
    if (cached) return cached
  }

  if (request.mode === 'navigate') {
    const offlinePage = await caches.match('/offline')
    if (offlinePage) return offlinePage
  }

  return new Response(JSON.stringify({ error: 'offline-subscription-required' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })
})
```

---

## `nuxt.config.ts` changes

- Add `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`
- Remove the entire `runtimeCaching` array (moves to `sw.ts`)
- Add `/offline` to `additionalManifestEntries` so it is precached:
  ```ts
  additionalManifestEntries: [{ url: '/offline', revision: null }]
  ```
- Keep `cleanupOutdatedCaches`, `globPatterns`, `maximumFileSizeToCacheInBytes` unchanged

---

## `src/communication/subscription.ts`

Single exported function:

```ts
export async function fetchSubscriptionStatus(
  userId: string,
  client: SupabaseClient
): Promise<{ subscribed: boolean; validUntil: string | null }>
```

Queries `user_subscriptions` where `user_id = userId` and `status = 'active'`. Returns the row's `ends_at` as `validUntil` (or `null` for lifetime/no-expiry subscriptions). Returns `{ subscribed: false, validUntil: null }` if no active row or on error — never throws.

---

## Offline page (`pages/offline.vue`)

Static, no data fetching. German language. Contents:

- Trailradar logo
- Headline: **"Offline-Modus"**
- Subline: "Du bist gerade offline."
- Body: "Offline-Zugriff auf Trails und Karte ist für Abonnenten verfügbar. Mit einem Abo kannst du alle Trails, GPX-Tracks und Kartenausschnitte auch ohne Internetverbindung nutzen."
- Primary CTA button: "Jetzt abonnieren" → links to Creem.io checkout URL (set via `NUXT_PUBLIC_CREEM_CHECKOUT_URL` env var)
- Secondary: "Zurück" link that calls `history.back()`

The page is entirely self-contained — no layout imports that might try to fetch data.

---

## `stores/auth.ts` changes

Add one computed and one watcher:

```ts
const isSubscribed = ref(false)  // set by subscription-bridge plugin

// exposed in return { ... isSubscribed }
```

`isSubscribed` is a `ref` that the bridge plugin writes to directly after updating IndexedDB, so the rest of the app (e.g., a UI badge) can react to it.

---

## Error handling

| Scenario | Behaviour |
|---|---|
| IndexedDB unavailable (private browsing) | `readSubscriptionFlag` returns `{ subscribed: false }` — non-subscriber path |
| `user_subscriptions` fetch fails (network error on login) | Bridge writes `{ subscribed: false }` — conservative default |
| SW not yet active on first install | No gate — SW only intercepts after first install completes (standard PWA behaviour) |
| Subscription expires while offline | `validUntil` check in SW catches it; offline page shown |

---

## Testing

- **Unit (vitest):** `fetchSubscriptionStatus` — active row, expired row, missing row, DB error
- **Unit (vitest):** `readSubscriptionFlag` — subscribed, expired, empty DB
- **Unit (vitest):** subscription-bridge plugin — writes correct flag on login/logout
- **E2E (Playwright):** non-subscriber offline → sees `/offline` page; subscriber offline → sees cached map