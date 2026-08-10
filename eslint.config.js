// @ts-check
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const prettierConfig = require('eslint-config-prettier');

module.exports = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      // Ad-hoc local `expo export --output-dir` builds used for manual
      // debugging (e.g. dist-nomin, dist-sm) — not part of the normal build
      // pipeline (that always outputs to plain `dist/`, matched above), but
      // still just as much a generated bundle, so lint shouldn't crawl it.
      'apps/mobile/dist-*/**',
      '**/node_modules/**',
      '**/.expo/**',
      'apps/api/etl/raw/**',
      'apps/mobile/public/**',
      // Design-proposal exports (self-contained .dc.html mockups and their
      // generated support.js) — reference material, not app source.
      'docs/design/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: { react: { version: 'detect' } },
  },
  {
    // This file and other Node-run CommonJS config files (babel.config.js,
    // metro.config.js, ...) use `require`/`module`, not the TS project. Kept
    // last so it wins over the broader rule sets above for these files.
    files: ['**/*.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'writable', __dirname: 'readonly' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettierConfig,
);
