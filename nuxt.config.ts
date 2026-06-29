import { readFileSync, existsSync } from 'node:fs'
import { regions } from './build/region'
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
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
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
    '~/assets/css/variables.css',
    '~/assets/css/base.css',
    '~/assets/css/marker.css',
    '~/assets/css/spot_panel.css',
    '~/assets/css/lightbox.css',
    '~/assets/css/trail-tooltip.css',
    'leaflet/dist/leaflet.css',
    'leaflet.markercluster/dist/MarkerCluster.css',
    'leaflet.markercluster/dist/MarkerCluster.Default.css',
  ],

  pwa: {
    registerType: 'autoUpdate',
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
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
      globIgnores: ['trails/????????-????-????-????-????????????/index.html'],
      runtimeCaching: [
        {
          // Individual trail pages: cache on first visit, not on SW install.
          urlPattern: /\/trails\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'trail-pages',
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
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
        const [r1, r2, r3] = await Promise.all([
          fetch(`${url}/rest/v1/trails?select=id`, { headers: h }),
          fetch(`${url}/rest/v1/parks?select=id`, { headers: h }),
          fetch(`${url}/rest/v1/dirt_parks?select=id`, { headers: h }),
        ])
        const [trails, parks, dirtParks] = await Promise.all([
          r1.json() as Promise<{ id: string }[]>,
          r2.json() as Promise<{ id: string }[]>,
          r3.json() as Promise<{ id: string }[]>,
        ])
        const all = [...trails, ...parks, ...dirtParks]
        nitroConfig.prerender ||= {}
        nitroConfig.prerender.routes ||= []
        for (const t of all) {
          (nitroConfig.prerender.routes as string[]).push(`/trails/${t.id}`)
        }
        console.log(`  ✓ Added ${all.length} trail routes for prerender (${trails.length} trails, ${parks.length} parks, ${dirtParks.length} dirtparks)`)
      } catch (e) {
        console.warn('  ⚠ Could not fetch trail routes for prerender:', e)
      }
    },
  },

  compatibilityDate: '2025-05-13',
})
