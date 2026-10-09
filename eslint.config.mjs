// @ts-check
import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/', 'public/', 'shots/', 'worker/', '.cache/', '.lighthouseci/'] },
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,astro}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Inline <script> blocks (linted as virtual files inside the .astro file):
    // the GA snippet stays exactly as Google ships it, and the pre-paint
    // theme script is plain ES5 on purpose.
    files: ['**/*.astro/*'],
    rules: { 'prefer-rest-params': 'off', 'no-var': 'off', '@typescript-eslint/no-unused-vars': 'off' },
  },
];
