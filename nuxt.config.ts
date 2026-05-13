import { readFileSync, existsSync } from 'node:fs'

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
    'leaflet-gesture-handling/dist/leaflet-gesture-handling.css',
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
      ],
      failOnError: false,
    },
  },

  compatibilityDate: '2025-05-13',
})
