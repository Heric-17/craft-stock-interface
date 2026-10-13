import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Folders allowed to do arithmetic and formatting on money, quantities and
 * dates. Everywhere else the value objects and the formatters are the only
 * way in, and the rules below are what keeps that true without relying on
 * anyone remembering it.
 */
const VALUE_OBJECT_DIRS = ['src/shared/money/**', 'src/shared/quantity/**'];
const FORMAT_DIRS = ['src/shared/format/**'];

/** `Number`/`parseInt` live here too, for the route-parameter helper. */
const INTEGER_HELPER_DIRS = ['src/shared/lib/**'];

const NO_FLOAT_PARSING = [
  {
    selector: "CallExpression[callee.name='parseFloat']",
    message: 'parseFloat turns an exact decimal into a float. Use Money or Quantity from shared/.',
  },
  {
    selector: "CallExpression[callee.name='Number']",
    message: 'Number() turns an exact decimal into a float. Use Money or Quantity from shared/.',
  },
  {
    selector: "CallExpression[callee.name='parseInt']",
    message: 'Use toInt from shared/lib to read an integer out of a route parameter.',
  },
  {
    selector: "MemberExpression[object.name='Number'][property.name=/^(parseFloat|parseInt)$/]",
    message: 'Use Money, Quantity or toInt from shared/ instead of parsing numbers by hand.',
  },
];

const NO_LOCALE_FORMATTING = [
  {
    selector: 'MemberExpression[property.name=/^toLocale(String|DateString|TimeString)$/]',
    message: 'Locale formatting belongs in shared/format, in one place.',
  },
  {
    selector: "MemberExpression[object.name='Intl']",
    message: 'Intl belongs in shared/format, in one place.',
  },
];

/**
 * `toFixed` is a float rounding everywhere except inside the value objects,
 * where it is the opposite: the way to read the exact decimal expansion of a
 * `number` the API sent, so that `0.14499999999999999` becomes the `0.145`
 * somebody typed on the other side. It is allowed there and nowhere else.
 */
const NO_FLOAT_ROUNDING = [
  {
    selector: "MemberExpression[property.name='toFixed']",
    message: 'toFixed rounds a float. Format through shared/format.',
  },
];

const NO_AD_HOC_FORMATTING = [...NO_LOCALE_FORMATTING, ...NO_FLOAT_ROUNDING];

const NO_BROWSER_STORAGE = [
  {
    selector: 'MemberExpression[property.name=/^(localStorage|sessionStorage)$/]',
    message: 'No token or application state in browser storage. Session lives in memory.',
  },
];

/**
 * A colour belongs to the theme. A component asks for `bg-primary` and gets
 * whatever the installation's variables say that is; a hexadecimal or a
 * functional colour typed into a component is one the theme can no longer
 * change. The palette lives in `src/index.css`, and only there.
 */
const NO_COLOR_LITERALS = [
  {
    selector: 'Literal[value=/#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_])/]',
    message:
      'No hexadecimal colour in a component. Use a theme token (bg-primary, text-muted-foreground).',
  },
  {
    selector: 'Literal[value=/(^|[^a-zA-Z])(rgba?|hsla?|oklch|oklab|lab|lch)[(]/]',
    message:
      'No functional colour in a component. Use a theme token (bg-primary, text-muted-foreground).',
  },
  {
    selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_])/]',
    message:
      'No hexadecimal colour in a component. Use a theme token (bg-primary, text-muted-foreground).',
  },
];

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'node_modules', 'docs/v0-reference', 'src/shared/api/generated'],
  },

  // Build tooling: plain JS/CommonJS, outside the application's TypeScript project.
  {
    files: ['**/*.js', '**/*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'module',
    },
  },

  // The Vite config is TypeScript, and belongs to the Node project rather than
  // the application one.
  {
    files: ['vite.config.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
    ],
    plugins: { 'react-refresh': reactRefresh },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'No token or application state in browser storage. Session lives in memory.',
        },
        {
          name: 'sessionStorage',
          message: 'No token or application state in browser storage. Session lives in memory.',
        },
      ],

      'no-restricted-syntax': [
        'error',
        ...NO_FLOAT_PARSING,
        ...NO_AD_HOC_FORMATTING,
        ...NO_BROWSER_STORAGE,
      ],

      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*'],
              message: 'This is a Vite + React Router application. There is no Next.js here.',
            },
            {
              group: ['**/shared/api/http-client', '@/shared/api/http-client'],
              message:
                'Only features/<feature>/api may reach the HTTP client. Components and pages use the query hooks.',
            },
            {
              group: ['@/features/*/*'],
              message: 'Import another feature only through its index.ts, never by inner path.',
            },
          ],
        },
      ],
    },
  },

  // Components take their colours from the theme. Tests are left out: a fixture
  // may spell a `#1048` that is not a colour.
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.{test,spec}.tsx', 'src/test/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...NO_FLOAT_PARSING,
        ...NO_AD_HOC_FORMATTING,
        ...NO_BROWSER_STORAGE,
        ...NO_COLOR_LITERALS,
      ],
    },
  },

  // The value objects are where the arithmetic happens: they are allowed the
  // primitives everything else is denied.
  {
    files: VALUE_OBJECT_DIRS,
    rules: {
      'no-restricted-syntax': ['error', ...NO_LOCALE_FORMATTING, ...NO_BROWSER_STORAGE],
    },
  },

  // The single formatting module: Intl and toLocaleString live here.
  {
    files: FORMAT_DIRS,
    rules: {
      'no-restricted-syntax': ['error', ...NO_BROWSER_STORAGE],
    },
  },

  // The route-parameter helper, and nothing else, may read an integer out of a
  // string by hand.
  {
    files: INTEGER_HELPER_DIRS,
    rules: {
      'no-restricted-syntax': ['error', ...NO_AD_HOC_FORMATTING, ...NO_BROWSER_STORAGE],
    },
  },

  // The HTTP client is the module the restriction is about.
  {
    files: ['src/shared/api/**', 'src/features/*/api/**', 'src/test/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*'],
              message: 'This is a Vite + React Router application. There is no Next.js here.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  prettier,
);
