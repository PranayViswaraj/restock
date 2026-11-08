// ESLint flat config for the whole repo (server = Node, client = browser + JSX).
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', 'client/dist/**', 'server/data/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['server/**/*.js', 'scripts/**/*.js', 'eslint.config.js', 'client/vite.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['client/src/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Core ESLint can't see JSX usage, so capitalised components and `motion` are exempt.
      'no-unused-vars': ['warn', { varsIgnorePattern: '^(motion|[A-Z_])', argsIgnorePattern: '^_' }],
    },
  },
];
