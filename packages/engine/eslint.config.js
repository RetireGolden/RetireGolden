import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    // Maintenance scripts: plain Node ESM, never shipped (package.json `files`
    // covers dist/ and schema/ only). Without this block they match no config
    // and are linted with zero rules, so a typo in one goes unseen.
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
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
      'no-restricted-syntax': [
        'error',
        {
          // Determinism (DOCS/standards.md invariant 4): with no locale
          // argument the host ICU default decides, so `$1,234` renders as
          // `$1.234` or `1 234` off an en-US runtime. Engine-published
          // strings (insight evidence, decision explanations, projection
          // warnings) are part of the contract, not a rendering choice.
          selector: "CallExpression[callee.property.name='toLocaleString'][arguments.length=0]",
          message:
            'Zero-argument toLocaleString() takes the host locale. Use the pinned formatters in src/internal/evidenceFormat.ts, or pass an explicit locale.',
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
  {
    // The pinned formatters are the one module three layers share: the annual
    // ledger (projection/internal/annualAnnuityPurchaseFunding.ts), decisions,
    // and the detectors. Those layers already depend on each other in one
    // direction, so an import from here back into any of them — insights/
    // types.ts is the tempting one — closes a module cycle. It is a leaf by
    // construction today; this makes that enforced rather than only written
    // down in the module's own doc comment.
    files: ['src/internal/evidenceFormat.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*', './*', '../*', '**/*'],
              message:
                'src/internal/evidenceFormat.ts must stay an import-free leaf so every layer can use it without a cycle.',
            },
          ],
        },
      ],
    },
  },
])
