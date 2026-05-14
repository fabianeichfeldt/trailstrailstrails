import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    // Api.ts reads this at module load time; provide a stable value for tests
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://test.supabase.co'),
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
