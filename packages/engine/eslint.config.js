import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    // Engine purity: this package is pure domain math that must run in plain
    // Node with no browser globals and no ambient network access. See
    // README.md and DOCS/architecture.md in the repo root.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'recharts', 'jspdf', 'html2canvas', 'idb'],
              message: 'The engine must stay pure: no UI or storage imports.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Persistence belongs in the consuming app, not the engine.' },
        { name: 'indexedDB', message: 'Persistence belongs in the consuming app, not the engine.' },
        { name: 'document', message: 'No DOM access in the engine.' },
        { name: 'window', message: 'No DOM access in the engine.' },
        { name: 'fetch', message: 'No ambient network access in the engine — take IO through an injected seam.' },
      ],
    },
  },
])
