import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import svgLoader from 'vite-svg-loader';

export default defineConfig({
  // Same svg handling as nuxt.config.ts, so `import Icon from '~/assets/icons/x.svg'` is a component here too.
  plugins: [vue(), svgLoader({ defaultImport: 'component' })],
  resolve: {
    alias: {
      // Mirrors Nuxt's `~/` -> `srcDir` alias (see nuxt.config.ts `srcDir: 'app'`)
      // so component/test files that import via `~/...` resolve under vitest too.
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      // Nuxt's `@@/` -> project root alias, used e.g. by `@@/build/nearby`.
      '@@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  define: {
    // Api.ts reads this at module load time; provide a stable value for tests
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://test.supabase.co'),
  },
  test: {
    // DOM tests opt in per file with a `// @vitest-environment happy-dom` header; node skips that setup cost.
    environment: 'node',
    include: ['app/**/*.test.ts', 'server/**/*.test.ts', 'build/**/*.test.ts', 'scripts/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // Off by default so per-edit hooks stay fast; `npm run test:coverage` turns it on.
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts', 'build/**/*.ts', 'scripts/**/*.{ts,mjs}'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'app/types/database.types.ts'],
      reporter: ['text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
    },
  },
});
