import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { regions } from './build/region'
import { computeNearbyMap } from './build/nearby'
import { assignSpotsToRegions } from './build/regionSpots'
import { buildSitemapXml, buildBulkRedirectRows, redirectStubHtml, isSafeStubFrom, STATIC_SITEMAP_PATHS } from './build/sitemap'
import svgLoader from 'vite-svg-loader'
import { fetchAllSpots, buildSpotSnapshot, SPOT_SNAPSHOT_PATH } from './app/communication/spotSnapshot'

// Legacy /trails/<id>/ URLs (and slugs retired by a rename) → 301-equivalent
// redirect stubs written into the static output by the prerender:done hook
// below. Populated in the nitro:config hook from the same Supabase fetch that
// drives prerender/sitemap. See
// docs/superpowers/specs/2026-09-01-trail-slug-urls-design.md.
const redirectStubs: { from: string; to: string }[] = []
// Built in nitro:config, written only by prerender:done so prepare/dev never touch it.
let sitemapXml = ''

// SSR reads this; it must exist (every region -> []) even when the spot fetch fails.
function writeEmptyRegionsJson() {
  const empty: Record<string, never[]> = {}
  for (const slug of Object.keys(regions)) empty[slug] = []
  writeFileSync('public/regions.json', JSON.stringify(empty))
}

// Load .env.local explicitly — c12 loads it after config evaluation, so
// process.env is empty for VITE_* / NUXT_PUBLIC_* vars at config parse time.
const envFile = '.env.local'
if (existsSync(envFile)) {
  readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const eq = line.indexOf('=')
    if (eq > 0 && !process.env[line.slice(0, eq)]) {
      process.env[line.slice(0, eq)] = line.slice(eq + 1)
    }
  })
}

export default defineNuxtConfig({
  srcDir: 'app',
  serverDir: './server',
  // public/ and server/ resolve relative to rootDir by default on Nuxt 4
  // (they're srcDir-relative on Nuxt 3), so no dir.public override is
  // needed here — 'public' at the project root is already the default.

  // Off under Playwright: the DevTools 4 dock fetches its logo from nuxt.com, tripping the E2E no-external-requests safety net.
  devtools: { enabled: process.env.E2E !== '1' },

  experimental: {
    payloadExtraction: false,
    defaults: {
      nuxtLink: {
        prefetch: false,
      },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      titleTemplate: '%s | Trailradar',
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/png', href: '/assets/icon-192.png' },
        { rel: 'apple-touch-icon', href: '/assets/apple-touch-icon.png' },
      ],
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#1b4332' },
        { property: 'og:image', content: 'https://trailradar.org/assets/hero-desktop.webp' },
        { property: 'og:type', content: 'website' },
      ],
      script: [
        {
          // Capture beforeinstallprompt before any framework JS runs.
          // The Nuxt plugin reads window.__pwaPrompt once the app initialises.
          innerHTML: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaPrompt=e;});`,
          type: 'text/javascript',
        },
      ],
    },
  },

  components: [
    { path: '~/components', pathPrefix: false },
  ],

  typescript: {
    tsConfig: {
      compilerOptions: {
        verbatimModuleSyntax: false,
      },
    },
  },

  vite: {
    plugins: [svgLoader({ defaultImport: 'component' })],
    esbuild: {
      tsconfigRaw: {
        compilerOptions: {
          verbatimModuleSyntax: false,
        },
      },
    },
  },

  modules: [
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
  ],

  css: [
    '@fortawesome/fontawesome-free/css/all.css',
    '~/assets/css/fontawesome-font-display.css',
    '~/assets/css/variables.css',
    '~/assets/css/base.css',
    '~/assets/css/marker.css',
    '~/assets/css/spot_panel.css',
    '~/assets/css/spotmanager-shared.css',
    '~/assets/css/lightbox.css',
    '~/assets/css/confirmDialog.css',
    '~/assets/css/trail-tooltip.css',
    'leaflet/dist/leaflet.css',
    'leaflet.markercluster/dist/MarkerCluster.css',
    'leaflet.markercluster/dist/MarkerCluster.Default.css',
  ],

  pwa: {
    registerType: 'autoUpdate',
    client: {
      // Poll for a new service worker hourly (fetch is sent with
      // `cache: 'no-store'`, so it bypasses any CDN/browser cache on
      // /sw.js). Without this, a long-lived tab only checks for an update
      // on navigation, and a CDN-cached /sw.js can keep it on an old
      // worker for hours.
      periodicSyncForUpdates: 60 * 60,
    },
    manifest: {
      name: 'Trailradar - Offizielle MTB Trails',
      short_name: 'Trailradar',
      description: 'Alle offiziell genehmigten MTB Trails in Deutschland und Europa auf einer Karte.',
      theme_color: '#1b4332',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      lang: 'de',
      categories: ['sports', 'navigation', 'lifestyle'],
      screenshots: [
        { src: '/assets/hero-desktop.webp', sizes: '1920x1440', type: 'image/webp', form_factor: 'wide', label: 'Trailradar Kartenansicht' },
      ],
      icons: [
        { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/assets/icon-512.png', sizes: '1024x1024', type: 'image/png' },
        { src: '/assets/icon-512.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      cleanupOutdatedCaches: true,
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      // HTML is deliberately NOT precached. Precached HTML is served
      // cache-first and only replaced when a *new service worker* installs
      // and activates — so if the /sw.js update check is delayed (a
      // CDN-cached service worker script, an offline tab), a returning
      // visitor is pinned to whatever HTML the worker cached on their last
      // visit, for as long as that worker stays in control. Precaching only
      // the content-hashed build assets (which are safe to keep forever)
      // and serving every navigation network-first (below) means a content
      // deploy shows up on the next online visit regardless of the worker's
      // own update timing.
      globPatterns: ['**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
      // @vite-pwa/nuxt defaults navigateFallback to '/', which registers a
      // NavigationRoute *before* the runtimeCaching rules below and wins the
      // routing race for any URL that isn't an exact string match in the
      // precache manifest — silently serving the cached homepage instead.
      // This site is fully SSG (every real route has real generated HTML),
      // so there's no app-shell to fall back to; disable it and let the
      // runtimeCaching rules below (or a normal network request) handle
      // every route on its own terms.
      navigateFallback: null,
      runtimeCaching: [
        {
          // The spot-detail page (app/pages/trails/[slug].vue) embeds the map
          // as <iframe src="/embed/[token]/?…">, and that page fetches its
          // data from the /_embed/[token] Cloudflare Worker. Neither path is
          // part of this SSG build. They must be kept OUT of the generic
          // "navigate" rule below: a navigation request is issued with
          // redirect:"manual", so any redirect on the iframe URL (e.g. a
          // GitHub Pages trailing-slash 301) reaches the worker as an
          // opaqueredirect it then caches and replays — the embedded map
          // renders blank / a stale shell in the installed PWA while the main
          // /map keeps working. Give each its own network-first cache so the
          // embed also survives offline, and so a poisoned entry can never
          // leak into the "pages" cache.
          urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/embed/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'embed-page',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/_embed/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'embed-data',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Every page navigation (the homepage, /map, region pages, every
          // /trails/* spot page): network-first with a short timeout, so a
          // returning online visitor always gets the freshly deployed HTML,
          // and an offline/slow one still falls back to the last copy seen.
          // /embed/ and /_embed/ are excluded — they have their own caches
          // above (a redirect on an iframe navigation poisons this one).
          urlPattern: ({ request, url }: { request: Request; url: URL }) =>
            request.mode === 'navigate'
            && !url.pathname.startsWith('/embed/')
            && !url.pathname.startsWith('/_embed/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'pages',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'osm-tiles',
            expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/trails.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'supabase-rest-trails',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/parks.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'supabase-rest-parks',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/dirt_parks.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'supabase-rest-dirtparks',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/spot_gpx_.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'supabase-rest-gpx',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/v1\/.+-details.*/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'supabase-functions',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https?:\/\/[^/]+\/api\/trail(s|\/.*)?$/i,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'nuxt-api',
            networkTimeoutSeconds: 3,
            expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Build-time "Nearby Spots" index (public/nearby.json). Not in
          // globPatterns on purpose — adding `json` there would precache
          // every per-route _payload.json too. StaleWhileRevalidate so it
          // works offline after the first online load and refreshes in the
          // background on later visits.
          urlPattern: /\/nearby\.json$/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'nearby-index',
            expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/trail-photos\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'trail-photos',
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
  },

  supabase: {
    url: process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    redirect: false,
    useSsrCookies: false,
  },

  routeRules: {
    // Allow the embed page to be loaded inside iframes on any external domain.
    // Host-level security is enforced server-side in /_embed/[token].
    '/embed/**': {
      headers: {
        'Content-Security-Policy': "frame-ancestors *",
        'X-Frame-Options': '',
      },
    },
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        '/map',
        '/about',
        '/articles',
        '/business',
        '/faq',
        '/impressum',
        '/kontakt',
        '/legal',
        '/plans',
        '/privacy',
        '/support',
        '/terms',
        '/how-to-embed',
        '/trailmanagement',
        '/reset-password',
        '/supporter/danke',
        '/kuendigen',
        '/trailradar-vs-komoot',
        '/trailradar-vs-trailforks',
        ...Object.keys(regions).map(slug => `/trails/${slug}`),
      ],
      failOnError: false,
    },
  },

  hooks: {
    async 'nitro:config'(nitroConfig) {
      const url = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
      const key = process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY
      if (!url || !key) { writeEmptyRegionsJson(); return }
      try {
        const h = { apikey: key, Authorization: `Bearer ${key}` }
        // One paged bulk fetch of every visible spot (base + details + photos) feeds the
        // prerendered spot pages (snapshot), nearby.json, regions.json, sitemap and stubs.
        const spots = await fetchAllSpots(`${url}/rest/v1`, h)
        mkdirSync(dirname(SPOT_SNAPSHOT_PATH), { recursive: true })
        writeFileSync(SPOT_SNAPSHOT_PATH, JSON.stringify(buildSpotSnapshot(spots)))
        console.log(`  ✓ Wrote spot snapshot for ${spots.length} spots`)

        const all = spots.map(s => ({
          id: String(s.id), slug: s.slug as string, name: s.name, latitude: s.latitude, longitude: s.longitude,
          approved: !!s.approved, type: s.type,
        }))
        const countOf = (type: string) => all.filter(s => s.type === type).length

        // First photo (photos are ordered created_at.asc) per spot.
        const photoBySpotId: Record<string, string> = {}
        for (const s of spots) {
          if (s.photos[0]?.url) photoBySpotId[String(s.id)] = s.photos[0].url
        }
        writeFileSync(
          'public/nearby.json',
          JSON.stringify(computeNearbyMap(all, { maxKm: 100, photoBySpotId })),
        )
        console.log(`  ✓ Generated nearby.json for ${all.length} spots`)

        const regionSpots = assignSpotsToRegions(all, regions)
        writeFileSync('public/regions.json', JSON.stringify(regionSpots))
        console.log(`  ✓ Generated regions.json for ${Object.keys(regionSpots).length} regions`)

        nitroConfig.prerender ||= {}
        nitroConfig.prerender.routes ||= []
        for (const t of all) {
          (nitroConfig.prerender.routes as string[]).push(`/trails/${t.slug || t.id}`)
        }
        console.log(`  ✓ Added ${all.length} trail routes for prerender (${countOf('trail')} trails, ${countOf('bikepark')} parks, ${countOf('dirtpark')} dirtparks)`)

        // Generate sitemap.xml from the same route data used for prerendering
        // above, so it can never drift out of sync with the actual site
        // (it previously was a hand-maintained file that omitted the
        // homepage and referenced dead pre-migration .html URLs).
        sitemapXml = buildSitemapXml({
          regions,
          regionSpots,
          spotSlugs: all.map(t => t.slug || t.id),
          staticPaths: STATIC_SITEMAP_PATHS,
        })
        console.log(`  ✓ Prepared sitemap.xml with ${(sitemapXml.match(/<loc>/g) ?? []).length} URLs`)

        // Legacy-URL redirect stubs (written to the static output by the
        // prerender:done hook). Two sources:
        //   1. every spot's id → its current slug (old /trails/<uuid>/ links)
        //   2. every retired slug in spot_slugs → the spot's current slug
        //      (a slug freed by a rename)
        const currentSlugById = new Map(all.map(t => [t.id, t.slug || t.id]))
        redirectStubs.length = 0
        for (const t of all) {
          if (t.slug && t.slug !== t.id) redirectStubs.push({ from: t.id, to: t.slug })
        }
        try {
          const retiredRes = await fetch(`${url}/rest/v1/spot_slugs?is_current=eq.false&select=slug,spot_id`, { headers: h })
          const retired = retiredRes.ok ? await retiredRes.json() as { slug: string; spot_id: string }[] : []
          for (const r of Array.isArray(retired) ? retired : []) {
            const to = currentSlugById.get(r.spot_id)
            if (to && to !== r.slug) redirectStubs.push({ from: r.slug, to })
          }
        } catch (e) {
          console.warn('  ⚠ Could not fetch retired slugs for redirect stubs:', e)
        }
        console.log(`  ✓ Prepared ${redirectStubs.length} legacy-URL redirect stubs`)
      } catch (e) {
        console.warn('  ⚠ Could not fetch trail routes for prerender:', e)
        // A previous build's snapshot would prerender stale pages; pages resolve live instead.
        rmSync(SPOT_SNAPSHOT_PATH, { force: true })
        if (!existsSync('public/regions.json')) writeEmptyRegionsJson()
      }

      // /embed/[token].vue is a real page, not just the /_embed/[token] API
      // (that part is served by the Cloudflare Worker at runtime). Nitro's
      // crawler only follows <a href>, never <iframe src>, so the embed
      // page itself is never discovered — every embed token 404s in
      // production unless explicitly prerendered here.
      try {
        const h = { apikey: key, Authorization: `Bearer ${key}` }
        const tokensRes = await fetch(`${url}/rest/v1/embed_tokens?select=token&is_active=eq.true`, { headers: h })
        const tokens = await tokensRes.json() as { token: string }[]
        nitroConfig.prerender ||= {}
        nitroConfig.prerender.routes ||= []
        for (const t of tokens) {
          (nitroConfig.prerender.routes as string[]).push(`/embed/${t.token}`)
        }
        console.log(`  ✓ Added ${tokens.length} embed token routes for prerender`)
      } catch (e) {
        console.warn('  ⚠ Could not fetch embed token routes for prerender:', e)
      }
    },

    // Write the legacy-URL redirect stubs into the static output once
    // prerendering has finished (so the real /trails/<slug>/index.html pages
    // already exist and are never clobbered). Each stub is a 200 response with
    // a canonical + instant meta-refresh to the slug URL — Google consolidates
    // it like a permanent redirect, and GitHub Pages can't serve a real 301.
    'nitro:init'(nitro) {
      nitro.hooks.hook('prerender:done', () => {
        const publicDir = nitro.options.output.publicDir
        if (sitemapXml) {
          writeFileSync(`${publicDir}/sitemap.xml`, sitemapXml)
          console.log(`  ✓ Wrote sitemap.xml into ${publicDir}`)
        }
        if (!redirectStubs.length) return
        let written = 0
        for (const { from, to } of redirectStubs) {
          if (!isSafeStubFrom(from)) continue
          const file = `${publicDir}/trails/${from}/index.html`
          if (existsSync(file)) continue // a real prerendered page — never overwrite
          mkdirSync(`${publicDir}/trails/${from}`, { recursive: true })
          writeFileSync(file, redirectStubHtml(`/trails/${to}/`))
          written++
        }
        console.log(`  ✓ Wrote ${written} legacy-URL redirect stubs into ${publicDir}/trails/`)
        // Outside publicDir on purpose: a Cloudflare Bulk Redirects import file, not a served asset.
        const rows = buildBulkRedirectRows(redirectStubs)
        writeFileSync(`${nitro.options.output.dir}/cloudflare-bulk-redirects.csv`, rows.join('\n') + '\n')
        console.log(`  ✓ Wrote cloudflare-bulk-redirects.csv (${rows.length} rows)`)
      })
    },
  },

  compatibilityDate: '2025-05-13',
})
