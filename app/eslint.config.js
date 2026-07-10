import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', '.cache', 'artifacts']),
  {
    files: ['playwright.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Engine purity: src/engine is pure domain math — no UI or storage imports.
    // See app/src/engine/README.md and DOCS/architecture.md.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'recharts', 'jspdf', 'html2canvas', 'idb'],
              message: 'src/engine must stay pure: no UI or storage imports.',
            },
            {
              group: ['../pages/*', '../pdf/*', '../data/*', '**/data/planStore'],
              message: 'src/engine must not depend on app-layer code.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Persistence belongs in src/data/, not the engine.' },
        { name: 'indexedDB', message: 'Persistence belongs in src/data/, not the engine.' },
        { name: 'document', message: 'No DOM access in the engine.' },
        { name: 'window', message: 'No DOM access in the engine.' },
      ],
    },
  },
])
