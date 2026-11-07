// Mutation testing: `npm run test:mutation` (whole suite, slow) or
// `npm run test:mutation -- --mutate "app/communication/**/*.ts"` to scope it.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: [
    'app/**/*.ts',
    'server/**/*.ts',
    'build/**/*.ts',
    '!**/*.test.ts',
    '!**/*.d.ts',
    '!app/types/database.types.ts',
  ],
  // The sandbox skips gitignored files, but tsconfig extends the generated .nuxt/tsconfig.json.
  ignorePatterns: ['!.nuxt'],
  // Re-runs only mutants whose code or tests changed since the last run.
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  coverageAnalysis: 'perTest',
  tempDirName: '.stryker-tmp',
  thresholds: { high: 80, low: 60, break: null },
};
