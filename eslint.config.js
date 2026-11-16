/**
 * ESLint flat config (ESLint 9).
 * Base rules come from @react-native/eslint-config's flat export.
 */

const rnFlatConfig = require('@react-native/eslint-config/flat');

module.exports = [
  ...rnFlatConfig,
  {
    ignores: [
      'node_modules/',
      'android/',
      'ios/',
      'coverage/',
      'jest.setup.js',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // The light-premium UI is built with StyleSheet, not inline styles.
      'react-native/no-inline-styles': 'warn',
      // Keep the codebase warning-free: unused vars are errors.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
      // `void` marks intentionally fire-and-forget promises
      // (e.g. void syncPending()); the base config warns on it.
      'no-void': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
