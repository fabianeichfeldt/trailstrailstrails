export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
  ],

  css: ['~/assets/css/variables.css'],

  supabase: {
    // Reads existing .env.local keys — no rename needed during migration
    url: process.env.VITE_SUPABASE_URL,
    key: process.env.VITE_SUPABASE_ANON_KEY,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/*'],
    },
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
    },
  },

  compatibilityDate: '2025-05-13',
})
