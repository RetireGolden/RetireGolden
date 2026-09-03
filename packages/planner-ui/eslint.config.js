import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const tsconfigRootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig([
  globalIgnores(['coverage', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
  },
  {
    // Type-checked rules that are high-signal on real source read as noise
    // on test doubles: mock objects typed as `unknown`/loosely-cast trigger
    // no-unsafe-*; stub methods that satisfy an async interface but never
    // await anything trigger require-await; `expect(mock.method)` assertions
    // trigger unbound-method's this-scoping warning even though the method
    // is never called detached from its receiver. None of these catch real
    // bugs in this shape. no-floating-promises and no-misused-promises stay
    // on everywhere, including tests, because those two do catch real
    // unhandled-rejection bugs in setup/teardown.
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    // Build/maintenance tooling: plain Node ESM, never shipped. Without this
    // block these files match no config and are linted with zero rules, so a
    // typo in one goes unseen. Mirrors packages/engine/eslint.config.js.
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
])
