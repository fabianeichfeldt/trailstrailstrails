/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'communication-no-stores',
      comment: 'The data/HTTP layer must not depend on Pinia stores.',
      severity: 'error',
      from: { path: '^src/communication/' },
      to:   { path: '^src/stores/' },
    },
    {
      name: 'communication-no-composables',
      comment: 'The data/HTTP layer must not depend on Vue composables.',
      severity: 'error',
      from: { path: '^src/communication/' },
      to:   { path: '^src/composables/' },
    },
    {
      name: 'communication-no-map-ui',
      comment: 'The data/HTTP layer must not depend on map UI code.',
      severity: 'error',
      from: { path: '^src/communication/' },
      to:   { path: '^src/map/' },
    },
    {
      name: 'stores-no-map-ui',
      comment: 'Pinia stores must not depend on map UI code.',
      severity: 'error',
      from: { path: '^src/stores/' },
      to:   { path: '^src/map/' },
    },
    {
      name: 'map-no-stores',
      comment: 'Map UI must receive auth/state via injection, not by importing stores directly.',
      severity: 'error',
      from: { path: '^src/map/' },
      to:   { path: '^src/stores/' },
    },
    {
      name: 'no-circular',
      comment: 'Circular dependencies make code hard to reason about and test.',
      severity: 'warn',
      from: {},
      to:   { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.vue', '.js', '.mjs'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
