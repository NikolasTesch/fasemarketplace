import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/build/**', '**/.svelte-kit/**', 'apps/backend/src/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/auth-*.mjs', 'scripts/business-*.mjs', 'scripts/verify-access-ui.mjs', 'apps/backend/test/access*.integration.mjs', 'apps/backend/test/business.integration.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    files: ['scripts/verify-access-ui.mjs'],
    languageOptions: { globals: { getComputedStyle: 'readonly', document: 'readonly', innerWidth: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly' } },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
