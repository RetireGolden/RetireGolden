import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * The three private operations every `actions/` module used to re-declare, now
 * with one name and one home apiece.
 *
 * Six names for three operations is what this list ends: the snapshot validator
 * shipped as plainSnapshot/plainDataSnapshot/snapshot/plainRecord/record across
 * 24 definitions, the exact-keys guard as exactKeys/keysExactly/hasExactKeys/
 * exactRecord across 18, and the nonblank pair across 29 more. A reviewer could
 * not pattern-match across siblings, and a grep by any one name found a third of
 * the instances - which is exactly how two different snapshot hardening levels
 * stayed apart long enough to matter. Unifying them was PR #599; without this
 * rule the next module to need one of these three operations re-declares it
 * under a seventh name and the drift starts over.
 *
 * NOT on this list, deliberately: the bigint-to-cents helpers (safeCents,
 * centsFromBigInt, safeMoney). Their contracts genuinely differ - some take a
 * label, some return `| null`, one takes `unknown` and returns a plain number -
 * so a single home would have to be a union of four signatures. Nor `record` or
 * `snapshot`, which survive as ordinary local variable names in dozens of
 * places; banning either by identifier would be dozens of false positives on a
 * rule whose whole value is that it never cries wolf.
 */
const SHARED_ACTION_GUARDS = {
  home: 'src/actions/plainData.ts',
  names: [
    'plainDataSnapshot',
    'INVALID_SNAPSHOT',
    'exactKeys',
    'asUnknownRecord',
    'nonblank',
    'requireNonblankId',
  ],
}

const sharedActionGuardMessage =
  `Redefines a shared action guard. Import ${SHARED_ACTION_GUARDS.names.join(', ')} from ` +
  `${SHARED_ACTION_GUARDS.home} rather than declaring a local copy. A helper with a genuinely ` +
  'different contract (a typed throw, a nullable return) needs a different name, not a second ' +
  'definition of this one.'

const sharedActionGuardNamePattern = `/^(${SHARED_ACTION_GUARDS.names.join('|')})$/`

const localeRestriction = {
  // Determinism (DOCS/standards.md invariant 4): with no locale
  // argument the host ICU default decides, so `$1,234` renders as
  // `$1.234` or `1 234` off an en-US runtime. Engine-published
  // strings (insight evidence, decision explanations, projection
  // warnings) are part of the contract, not a rendering choice.
  selector: "CallExpression[callee.property.name='toLocaleString'][arguments.length=0]",
  message:
    'Zero-argument toLocaleString() takes the host locale. Use the pinned formatters in src/internal/evidenceFormat.ts, or pass an explicit locale.',
}

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
        localeRestriction,
        // Both shapes, because the copy that survived the manual sweep was a
        // block-scoped `const` arrow inside a function body, not a top-level
        // `function`. Also class methods and object-literal methods: a
        // redefinition does not have to be a free function or a variable to
        // cause the same grep-can't-tell-which-one drift this rule exists to
        // stop.
        {
          selector: `FunctionDeclaration[id.name=${sharedActionGuardNamePattern}]`,
          message: sharedActionGuardMessage,
        },
        {
          selector: `VariableDeclarator[id.name=${sharedActionGuardNamePattern}]`,
          message: sharedActionGuardMessage,
        },
        {
          selector: `MethodDefinition[key.name=${sharedActionGuardNamePattern}]`,
          message: sharedActionGuardMessage,
        },
        {
          selector: `Property[key.name=${sharedActionGuardNamePattern}][value.type=/FunctionExpression$/]`,
          message: sharedActionGuardMessage,
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
    // The home module itself, which has to declare what everywhere else has to
    // import. A narrow `files:` block rather than an `ignores:` on the block
    // above, matching the evidenceFormat precedent below, and it restates the
    // locale restriction because a later block replaces the rule outright for
    // the files it matches rather than merging into it.
    files: [SHARED_ACTION_GUARDS.home],
    rules: {
      'no-restricted-syntax': ['error', localeRestriction],
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
