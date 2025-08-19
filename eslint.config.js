import { createConfigs } from '@retn0/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  ...createConfigs(),
  {
    ignores: [
      '.react-router',
      'build',
      'app/components/ui/**/*',
    ],
  },
  {
    rules: {
      '@stylistic/operator-linebreak': ['error', 'after', {
        overrides: {
          '?': 'before',
          ':': 'before',
          '&': 'before',
          '|': 'before',
        },
      }],
      '@stylistic/multiline-ternary': ['error', 'always-multiline', {
        ignoreJSX: true,
      }],
      '@stylistic/jsx-one-expression-per-line': ['error', { allow: 'non-jsx' }],
    },
  },
  {
    files: [
      '**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': ['warn'],
    },
  },
]);
