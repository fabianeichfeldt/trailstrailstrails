import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Mirrors Nuxt's `~/` -> `srcDir` alias (see nuxt.config.ts `srcDir: 'app'`)
      // so component/test files that import via `~/...` resolve under vitest too.
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  define: {
    // Api.ts reads this at module load time; provide a stable value for tests
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://test.supabase.co'),
  },
  test: {
    environment: 'happy-dom',
    include: ['app/**/*.test.ts', 'server/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
