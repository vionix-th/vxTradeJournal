import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'dist-prod/**', 'dist-skill/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node, ...globals.browser, __APP_VERSION__: 'readonly', __BUILD_COMMIT__: 'readonly', __FIREBASE_CONFIG__: 'readonly', __CLI_VERSION__: 'readonly', __CLI_COMMIT__: 'readonly' } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  },
];
