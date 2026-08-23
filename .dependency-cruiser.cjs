/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'communication-no-stores',
      comment: 'The data/HTTP layer must not depend on Pinia stores.',
      severity: 'error',
      from: { path: '^app/communication/' },
      to:   { path: '^app/stores/' },
    },
    {
      name: 'communication-no-composables',
      comment: 'The data/HTTP layer must not depend on Vue composables.',
      severity: 'error',
      from: { path: '^app/communication/' },
      to:   { path: '^app/composables/' },
    },
    {
      name: 'communication-no-map-ui',
      comment: 'The data/HTTP layer must not depend on map UI code.',
      severity: 'error',
      from: { path: '^app/communication/' },
      to:   { path: '^app/map/' },
    },
    {
      name: 'stores-no-map-ui',
      comment: 'Pinia stores must not depend on map UI code.',
      severity: 'error',
      from: { path: '^app/stores/' },
      to:   { path: '^app/map/' },
    },
    {
      name: 'map-no-stores',
      comment: 'Map UI must receive auth/state via injection, not by importing stores directly.',
      severity: 'error',
      from: { path: '^app/map/' },
      to:   { path: '^app/stores/' },
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
