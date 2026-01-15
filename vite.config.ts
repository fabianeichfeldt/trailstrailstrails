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
      }
    }
  }
});
