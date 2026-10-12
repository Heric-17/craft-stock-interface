/**
 * The architecture rules, enforced instead of trusted.
 *
 * Direction of the dependencies:
 *
 *   app  ->  features  ->  shared
 *   pages -> components -> model
 *   api   -> model, shared/api
 *
 * A rule that depends on discipline degrades in silence, so every one of the
 * absolute constraints has an entry here and fails the build.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-next',
      comment:
        'This is a Vite + React Router application. The v0 export is a visual reference, not a framework.',
      severity: 'error',
      from: { path: '^src' },
      // Deliberately not narrowed by `dependencyTypes`: Next.js is not
      // installed, so an import of it resolves to nothing, and a rule that
      // only looked at real packages would let it through.
      to: { path: '^next($|/)' },
    },

    {
      name: 'no-unresolvable',
      comment: 'An import that resolves to nothing is a typo or a package nobody installed.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },

    {
      name: 'shared-stays-shared',
      comment: 'shared/ knows nothing about the features or the application shell.',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(features|app)/' },
    },

    {
      name: 'features-do-not-know-the-shell',
      comment: 'A feature is mounted by app/, never the other way round.',
      severity: 'error',
      from: { path: '^src/features/' },
      to: { path: '^src/app/' },
    },

    {
      name: 'cross-feature-only-through-index',
      comment:
        'One feature reaches another only through its index.ts. Reaching an inner path makes every file of a feature part of its public surface.',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/([^/]+)/',
        pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'],
      },
    },

    {
      name: 'http-client-only-in-feature-api',
      comment:
        'Components and pages use the query hooks in features/<feature>/api. The HTTP client is the one place that calls fetch.',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: ['^src/features/[^/]+/api/', '^src/shared/api/', '^src/test/'],
      },
      to: { path: '^src/shared/api/http-client\\.ts$' },
    },

    {
      name: 'dto-types-stay-in-api-and-model',
      comment:
        'A component receives a view model with Money and Quantity, never the decimal strings of a DTO.',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: ['^src/features/[^/]+/(api|model)/', '^src/shared/api/', '^src/test/'],
      },
      to: { path: '\\.dto\\.ts$' },
    },

    {
      name: 'generated-api-types-stay-in-api-and-model',
      comment:
        'Whatever is generated from the API contract is raw wire shape. It feeds the DTOs, it never reaches a component.',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: ['^src/features/[^/]+/(api|model)/', '^src/shared/api/'],
      },
      to: { path: '^src/shared/api/generated/' },
    },

    {
      name: 'model-is-pure-typescript',
      comment:
        'model/ holds pure functions: mappers, derivations, previews, schemas. No React, no fetch, no DOM — testable without rendering.',
      severity: 'error',
      from: { path: '^src/features/[^/]+/model/' },
      to: {
        dependencyTypes: ['npm'],
        path: '^(react|react-dom|react-router|@tanstack/react-query|@testing-library|sonner|lucide-react)($|/)',
      },
    },

    {
      name: 'model-does-not-fetch',
      comment: 'model/ never talks to the network. The hooks in api/ do.',
      severity: 'error',
      from: { path: '^src/features/[^/]+/model/' },
      to: { path: '^src/shared/api/(http-client|query-client)\\.ts$' },
    },

    {
      name: 'pages-and-components-do-not-import-api-internals',
      comment: 'A page reads server data through the feature hooks, not through another feature.',
      severity: 'error',
      from: { path: '^src/features/[^/]+/(pages|components)/' },
      to: { path: '^src/app/' },
    },

    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },

    {
      name: 'no-orphans',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(babel|webpack)\\.config\\.(js|cjs|mjs|ts|json)$',
          '^src/main\\.tsx$',
          '^src/test/',
          '\\.(test|spec)\\.(ts|tsx)$',
        ],
      },
      to: {},
    },

    {
      name: 'not-to-dev-dep',
      comment: 'Application code must not depend on a devDependency.',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: ['\\.(test|spec)\\.(ts|tsx)$', '^src/test/', '\\.d\\.ts$'],
      },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },

    {
      name: 'no-deprecated-core',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['core'], path: '^(punycode|domain|sys)$' },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(docs|dist|coverage)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
