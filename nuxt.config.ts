import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { regions } from './build/region'
import { computeNearbyMap } from './build/nearby'
import svgLoader from 'vite-svg-loader'

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

  devtools: { enabled: true },

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
          // Every page navigation (the homepage, /map, region pages, every
          // /trails/* spot page): network-first with a short timeout, so a
          // returning online visitor always gets the freshly deployed HTML,
          // and an offline/slow one still falls back to the last copy seen.
          urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
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
        '/legal',
        '/privacy',
        '/support',
        '/terms',
        '/reset-password',
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
      if (!url || !key) return
      try {
        const h = { apikey: key, Authorization: `Bearer ${key}` }
        // Widened from `select=id` to also carry name/coords/approved so the
        // same fetch feeds the build-time "Nearby Spots" computation
        // (public/nearby.json) — see build/nearby.ts. Each array is tagged
        // with its spot `type` the same way server/api/trails.get.ts does.
        const spotFields = 'id,slug,name,latitude,longitude,approved'
        const [r1, r2, r3, r4] = await Promise.all([
          fetch(`${url}/rest/v1/trails?select=${spotFields}`, { headers: h }),
          fetch(`${url}/rest/v1/parks?select=${spotFields}`, { headers: h }),
          fetch(`${url}/rest/v1/dirt_parks?select=${spotFields}`, { headers: h }),
          fetch(`${url}/rest/v1/trail_photos?select=trail_id,url&order=created_at.asc`, { headers: h }),
        ])
        type SpotRow = { id: string; slug: string; name: string; latitude: number; longitude: number; approved: boolean }
        const [trails, parks, dirtParks, photos] = await Promise.all([
          r1.json() as Promise<SpotRow[]>,
          r2.json() as Promise<SpotRow[]>,
          r3.json() as Promise<SpotRow[]>,
          r4.json() as Promise<{ trail_id: string; url: string }[]>,
        ])
        const all = [
          ...trails.map(t => ({ ...t, type: 'trail' as const })),
          ...parks.map(p => ({ ...p, type: 'bikepark' as const })),
          ...dirtParks.map(d => ({ ...d, type: 'dirtpark' as const })),
        ]

        // First photo (rows already ordered created_at.asc) per spot.
        const photoBySpotId: Record<string, string> = {}
        for (const p of Array.isArray(photos) ? photos : []) {
          if (p && p.trail_id && p.url && !photoBySpotId[p.trail_id]) {
            photoBySpotId[p.trail_id] = p.url
          }
        }
        writeFileSync(
          'public/nearby.json',
          JSON.stringify(computeNearbyMap(all, { maxKm: 100, photoBySpotId })),
        )
        console.log(`  ✓ Generated nearby.json for ${all.length} spots`)

        nitroConfig.prerender ||= {}
        nitroConfig.prerender.routes ||= []
        for (const t of all) {
          (nitroConfig.prerender.routes as string[]).push(`/trails/${t.slug || t.id}`)
        }
        console.log(`  ✓ Added ${all.length} trail routes for prerender (${trails.length} trails, ${parks.length} parks, ${dirtParks.length} dirtparks)`)

        // Generate sitemap.xml from the same route data used for prerendering
        // above, so it can never drift out of sync with the actual site
        // (it previously was a hand-maintained file that omitted the
        // homepage and referenced dead pre-migration .html URLs).
        const staticPages: { path: string; priority: string; changefreq: string }[] = [
          { path: '/', priority: '1.0', changefreq: 'daily' },
          { path: '/map', priority: '0.9', changefreq: 'daily' },
          { path: '/trailradar-vs-komoot', priority: '0.8', changefreq: 'monthly' },
          { path: '/trailradar-vs-trailforks', priority: '0.8', changefreq: 'monthly' },
          { path: '/articles', priority: '0.7', changefreq: 'weekly' },
          { path: '/about', priority: '0.6', changefreq: 'monthly' },
          { path: '/faq', priority: '0.6', changefreq: 'monthly' },
          { path: '/support', priority: '0.6', changefreq: 'monthly' },
          { path: '/business', priority: '0.6', changefreq: 'monthly' },
          { path: '/legal', priority: '0.3', changefreq: 'yearly' },
          { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
          { path: '/terms', priority: '0.3', changefreq: 'yearly' },
        ]
        const lastmod = new Date().toISOString().slice(0, 10)
        const urlXml = (loc: string, priority: string, changefreq: string) =>
          `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
        const sitemapEntries = [
          ...staticPages.map(p => urlXml(`https://trailradar.org${p.path}`, p.priority, p.changefreq)),
          ...Object.keys(regions).map(slug => urlXml(`https://trailradar.org/trails/${slug}`, '0.8', 'weekly')),
          ...all.map(t => urlXml(`https://trailradar.org/trails/${t.slug || t.id}`, '0.6', 'weekly')),
        ]
        const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.join('\n')}\n</urlset>\n`
        writeFileSync('public/sitemap.xml', sitemapXml)
        console.log(`  ✓ Generated sitemap.xml with ${sitemapEntries.length} URLs`)
      } catch (e) {
        console.warn('  ⚠ Could not fetch trail routes for prerender:', e)
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
  },

  compatibilityDate: '2025-05-13',
})
