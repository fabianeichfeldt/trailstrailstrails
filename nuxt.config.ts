import { readFileSync, existsSync } from 'node:fs'
import { regions } from './build/region'

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
    '~/assets/css/variables.css',
    '~/assets/css/base.css',
    '~/assets/css/marker.css',
    '~/assets/css/spot_panel.css',
    '~/assets/css/lightbox.css',
    'leaflet/dist/leaflet.css',
    'leaflet.markercluster/dist/MarkerCluster.css',
    'leaflet.markercluster/dist/MarkerCluster.Default.css',
  ],

  supabase: {
    url: process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/*'],
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
