// ===== eslint.config.mjs =====
// ESLint flat config for TypeScript + Prettier.
// Intentionally lenient on first setup; strictness will be increased gradually.

import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-plugin-prettier/recommended';

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  location: 'readonly',
  history: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  performance: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  alert: 'readonly',
};

const nodeGlobals = {
  __dirname: 'readonly',
  __filename: 'readonly',
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  process: 'readonly',
};

export default [
  js.configs.recommended,
  prettier,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
        ecmaVersion: 2022,
      },
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-useless-assignment': 'off',
      'no-case-declarations': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        sourceType: 'module',
        ecmaVersion: 2022,
      },
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-useless-assignment': 'off',
      'no-case-declarations': 'off',
      'no-console': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'release/**',
      'node_modules/**',
      '.tmp/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.md',
      '**/*.yml',
      '**/*.yaml',
      '**/*.json',
    ],
  },
];
