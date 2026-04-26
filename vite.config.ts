import { defineConfig } from "vite";
import { resolve } from "path";
import { VitePWA } from "vite-plugin-pwa";
console.log("VITE CONFIG LOADED");
export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["assets/apple-touch-icon.png", "assets/icon-192.png", "assets/icon-512.png"],
      manifest: {
        name: "Trailradar - Offizielle MTB Trails",
        short_name: "Trailradar",
        description: "Alle offiziell genehmigten MTB Trails in Deutschland und Europa auf einer Karte.",
        theme_color: "#0077cc",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "de",
        icons: [
          {
            src: "/assets/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/assets/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/assets/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        categories: ["sports", "navigation", "lifestyle"],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
        runtimeCaching: [
          {
            // Cache OpenStreetMap tiles
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "osm-tiles",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache Supabase API responses
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        profile: resolve(__dirname, "profile.html"),
        terms: resolve(__dirname, "terms.html"),
        privacy: resolve(__dirname, "privacy.html"),
        about: resolve(__dirname, "about.html"),
        business: resolve(__dirname, "business.html"),
        faq: resolve(__dirname, "faq.html"),
        legal: resolve(__dirname, "legal.html"),
        reset_password: resolve(__dirname, "reset_password.html"),
        support: resolve(__dirname, "support.html"),
        spotchecks: resolve(__dirname, "spotchecks/index.html"),
        kulmbach: resolve(__dirname, "spotchecks/kulmbach/index.html"),
        nuernberg: resolve(__dirname, "spotchecks/nuernberg/index.html"),
      }
    }
  }
});
