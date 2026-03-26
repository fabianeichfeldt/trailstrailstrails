import { defineConfig } from "vite";
import { resolve } from "path";
console.log("VITE CONFIG LOADED");
export default defineConfig({
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
      }
    }
  }
});
