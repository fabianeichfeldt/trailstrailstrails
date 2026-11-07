// Mutation testing: `npm run test:mutation` (whole suite, slow) or scope it with
// `MUTATE="app/communication/**/*.ts" npm run test:mutation` (comma-separated globs).
// Don't use `--mutate`: it replaces this whole list, so test files get mutated too.
const EXCLUDE = [
  '!**/*.test.ts', '!**/*.d.ts', '!app/types/database.types.ts',
  // Leaflet/Nuxt wiring only — the logic lives in tested modules (gpxLayer, gpxOverview, markerPresentation, nativeBack).
  '!app/composables/useTrailMap.ts', '!app/map/miniMap.ts', '!app/spot_manager/MapView.ts', '!app/plugins/**',
];
const scope = process.env.MUTATE?.split(',').map((g) => g.trim()).filter(Boolean);

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: [...(scope?.length ? scope : ['app/**/*.ts', 'server/**/*.ts', 'build/**/*.ts']), ...EXCLUDE],
  // The sandbox skips gitignored files, but tsconfig extends the generated .nuxt/tsconfig.json.
  ignorePatterns: ['!.nuxt'],
  // Static mutants (module-level consts, e.g. SPOT_TYPES) force a full-suite run each; skipping them is the biggest speedup.
  ignoreStatic: true,
  // Re-runs only mutants whose code or tests changed since the last run.
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  coverageAnalysis: 'perTest',
  tempDirName: '.stryker-tmp',
  thresholds: { high: 80, low: 60, break: null },
};
