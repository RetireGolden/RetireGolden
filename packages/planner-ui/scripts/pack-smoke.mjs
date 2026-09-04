#!/usr/bin/env node
/**
 * Packs @retiregolden/planner-ui and exercises the resulting tarball the way
 * an external consumer (the Pro renderer) will: install it into a scratch
 * Vite + React project — from the tarball, not a workspace symlink — and run
 * a production `vite build`.
 *
 * The dev loop never touches the published surface (the app aliases the
 * package to its source directory), so this is the one check that proves the
 * exports map resolves, the shipped source compiles under a consumer's Vite,
 * dep-internal `new Worker(new URL(...))` chunks are emitted, and the HiGHS
 * wasm asset makes it into the bundle. The full runtime proof (Monte Carlo +
 * optimizer executing in a browser) was done manually against 0.1.0 — this
 * guards the packaging regressions that would break it.
 *
 * The scratch consumer deliberately does NOT install `pdfjs-dist`, so it is
 * also the guard for the optional peer, which has broken in both directions
 * here: a literal `import('pdfjs-dist/...')` in the shipped source makes THIS
 * BUILD fail for every host that never wanted PDF support, and the fix for that
 * (an unanalyzable specifier) left a bare npm package name in the bundle that
 * no browser can resolve at run time. `src/main.tsx` imports `./document-text`
 * so the first half cannot regress unnoticed, and `documentTextSmoke.ts` — an
 * SSR-bundled entry, so the shipped source really is compiled and executed —
 * calls the extractor without the peer and asserts it answers
 * `pdfjs_unavailable` as a result rather than throwing.
 *
 * Note: @retiregolden/engine is installed from the npm registry at the
 * version range the package declares, exactly as a consumer would get it.
 * Run from anywhere: `node packages/planner-ui/scripts/pack-smoke.mjs`.
 */
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const pkgDir = resolve(scriptsDir, '..')
const enginePkgDir = resolve(pkgDir, '..', 'engine')
const shell = process.platform === 'win32' // pnpm is pnpm.cmd on Windows
const engineSourceMode = process.env.PLANNER_PACK_SMOKE_ENGINE_SOURCE ?? 'auto'
if (!['auto', 'local', 'registry'].includes(engineSourceMode)) {
  throw new Error(
    'pack smoke FAILED: PLANNER_PACK_SMOKE_ENGINE_SOURCE must be auto, local, or registry',
  )
}

const plannerPackage = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
const engineRange = plannerPackage.dependencies?.['@retiregolden/engine']
// Must be a normal caret range. `workspace:` would link locally, but this
// package is released with `npm publish` (OIDC), which does not rewrite
// workspace protocol — npm consumers cannot resolve it. Local checkout
// linking comes from `linkWorkspacePackages: true` in pnpm-workspace.yaml.
const minimumEngineMatch = typeof engineRange === 'string' ? /^\^(\d+\.\d+\.\d+)$/.exec(engineRange) : null
if (minimumEngineMatch === null) {
  throw new Error(
    `pack smoke FAILED: expected planner-ui to declare a caret engine range, got ${JSON.stringify(engineRange)}`,
  )
}
const minimumEngineVersion = minimumEngineMatch[1]

// Is the declared minimum actually on the registry? Only a genuine
// "that version does not exist" may answer no. This used to catch every
// error and return false, which made a network blip, a rate limit or an
// auth failure indistinguishable from an unpublished version: `auto` would
// quietly fall back to the local engine and CI would stay green while the
// registry-resolution path — the thing this smoke test exists to prove —
// went unexercised. Anything that is not a clear absence now throws.
//
// `--json` is what makes the distinction reliable: npm reports the failure
// as structured JSON on stdout, so this reads `error.code` rather than
// pattern-matching a message. E404 on a specific version of a PUBLIC
// package means that version is not published. (npm also returns E404 for
// a package you cannot see, which is why this stays scoped to the one
// public package name it asks about.)
const registryHasMinimumEngine = () => {
  const spec = `@retiregolden/engine@${minimumEngineVersion}`
  let stdout
  try {
    stdout = execFileSync('pnpm', ['view', spec, 'version', '--json'], {
      encoding: 'utf8',
      shell,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch (error) {
    let code
    try {
      code = JSON.parse(String(error?.stdout ?? ''))?.error?.code
    } catch {
      code = undefined
    }
    if (code === 'E404') return false
    throw new Error(
      `pack smoke FAILED: could not determine whether ${spec} is published ` +
        `(npm error code ${String(code ?? 'unknown')}). Refusing to guess: treating this as ` +
        `"unpublished" would silently skip the registry-resolution check. ` +
        `Set PLANNER_PACK_SMOKE_ENGINE_SOURCE=local to pack the workspace engine deliberately.`,
      { cause: error },
    )
  }
  return JSON.parse(stdout) === minimumEngineVersion
}

const viteConfig = `
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@retiregolden/planner-ui'],
    include: ['@retiregolden/planner-ui > highs', '@retiregolden/planner-ui > recharts'],
  },
  // The package ships TypeScript source, so the SSR build below has to bundle
  // it rather than externalize it — externalized, node would be handed a .ts
  // file to parse. Bundling is also what makes that build a real test of the
  // shipped source.
  ssr: { noExternal: ['@retiregolden/planner-ui'] },
})
`

const mainTsx = `
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useRoutes } from 'react-router'
import '@retiregolden/planner-ui/index.css'
// The host surface, route groups, and stable format subpaths must all resolve
// from the tarball's exports map.
import {
  PlannerApp,
  PlanStoreProvider,
  indexedDbPlanStore,
  plannerContentRoutes,
  plannerWorkspaceRoutes,
  type PlanStore,
} from '@retiregolden/planner-ui'
import { parseV2Backup, serializeV2Backup } from '@retiregolden/planner-ui/plan-format'
import { parseCompleteExportManifest } from '@retiregolden/planner-ui/complete-export'
import { taxCalculatorFor } from '@retiregolden/planner-ui/plan-tax-calculator'
import {
  runSpendingSolve,
  type SpendingSolveEvidence,
  type SpendingSolveRequest,
  type SpendingSolveResponse,
  type SpendingSolveResult,
  type SpendingSolveRunOptions,
} from '@retiregolden/planner-ui/spending-solve'
// The optional-peer subpath. Nothing here installs pdfjs-dist, so a literal
// pdfjs specifier in the shipped source would fail THIS build — which is the
// regression that reached a release once already.
import { MAX_DOCUMENT_BYTES, extractDocumentText } from '@retiregolden/planner-ui/document-text'
// Every stability-promised subpath is named here EXPLICITLY, and this build is
// what proves each one COMPILES from the tarball. It is not what proves the
// exports map is complete: the exports sweep run before this build walks every
// key in the packed manifest, including the deep subpaths that used to reach
// consumers through the "./*" wildcard 0.10.0 removed.
import { MIGRATION_ADAPTERS, identifyMigrationExport } from '@retiregolden/planner-ui/migration-source'
import {
  applyIntakeRefresh,
  buildIntakeRefreshDelta,
  classifyIntakeRefresh,
  defaultIntakeRefreshSelection,
} from '@retiregolden/planner-ui/intake-refresh'
import {
  buildReportModel,
  parseReportModel,
  serializeReportModel,
  REPORT_BLOCK_IDS,
} from '@retiregolden/planner-ui/report-model'
import {
  projectPlan,
  currentStartYear,
  type ProjectionView,
} from '@retiregolden/planner-ui/projection'

// A host-shaped adapter (not the browser store) so both injection routes —
// the planStore prop and a wrapping PlanStoreProvider — compile against a
// real implementation of the interface. Runtime injection semantics are
// covered by data/planStoreContext.test.tsx; this file proves the surface
// resolves and bundles from the tarball.
const hostStore: PlanStore = {
  listPlans: () => indexedDbPlanStore.listPlans(),
  loadPlan: (id) => indexedDbPlanStore.loadPlan(id),
  savePlan: (plan) => indexedDbPlanStore.savePlan(plan),
  deletePlan: (id) => indexedDbPlanStore.deletePlan(id),
}

function WorkspaceOnlyHost() {
  return useRoutes([...plannerWorkspaceRoutes, ...plannerContentRoutes])
}

type SpendingSolveContract = {
  request: SpendingSolveRequest
  options: SpendingSolveRunOptions
  result: SpendingSolveResult
  evidence: SpendingSolveEvidence
  response: SpendingSolveResponse
}
const spendingSolveContract: SpendingSolveContract | undefined = undefined

type ProjectionContract = ProjectionView | undefined
const projectionContract: ProjectionContract = undefined
const completeExportProbe = parseCompleteExportManifest('{}')
if (completeExportProbe.ok || completeExportProbe.reason !== 'not_complete_export') {
  throw new Error('pack smoke FAILED: complete-export must refuse an empty object as not_complete_export')
}

console.debug(
  parseV2Backup(serializeV2Backup([])).ok,
  completeExportProbe.reason,
  WorkspaceOnlyHost.name,
  PlanStoreProvider.name,
  MAX_DOCUMENT_BYTES,
  extractDocumentText.name,
  MIGRATION_ADAPTERS.projectionlab.displayName,
  identifyMigrationExport('{}') === null,
  classifyIntakeRefresh.name,
  defaultIntakeRefreshSelection.name,
  buildIntakeRefreshDelta.name,
  applyIntakeRefresh.name,
  taxCalculatorFor.name,
  runSpendingSolve.name,
  spendingSolveContract,
  buildReportModel.name,
  parseReportModel.name,
  serializeReportModel.name,
  REPORT_BLOCK_IDS.length,
  projectPlan.name,
  currentStartYear.name,
  projectionContract,
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PlannerApp planStore={hostStore} />
    </BrowserRouter>
  </StrictMode>,
)
`

// Built for node, not the browser, so the shipped source can actually be RUN
// without the optional peer — a build alone would not notice the module
// answering `pdfjs_unavailable` to a host that installed pdfjs, or throwing
// where it promises a result union. Written without template literals so it
// survives being one.
const documentTextSmoke = [
  "import { extractDocumentText } from '@retiregolden/planner-ui/document-text'",
  '',
  '// A PDF header over nothing: enough to pass every pre-parse check (readable',
  '// input, inside the byte cap, %PDF- present) so the call gets as far as',
  '// needing pdfjs — which this consumer deliberately never installed.',
  'const headerOnly = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a])',
  '',
  'const fail = (why) => {',
  "  throw new Error('pack smoke FAILED: ' + why)",
  '}',
  '',
  'async function main() {',
  '  const result = await extractDocumentText(headerOnly)',
  "  if (result.ok) fail('expected a failure result without pdfjs-dist installed, got ok')",
  "  if (result.reason !== 'pdfjs_unavailable') {",
  "    fail('expected pdfjs_unavailable, got ' + result.reason + ' (' + result.message + ')')",
  '  }',
  '  // Both remedies, because installing the package is not one of them in a',
  '  // browser bundle: the specifier is unresolvable there however it is installed.',
  "  if (!result.message.includes('options.pdfjs')) {",
  "    fail('pdfjs_unavailable must name options.pdfjs as a remedy: ' + result.message)",
  '  }',
  "  console.log('pack smoke: document-text without the peer -> ' + result.reason)",
  '}',
  '',
  'main().catch((error) => {',
  '  console.error(String((error && error.message) || error))',
  '  process.exit(1)',
  '})',
  '',
].join('\n')

// The exports map itself, swept from the PACKED manifest rather than from a
// list kept in this file. 0.10.0 replaced `"./*": "./src/*.ts"` with one
// explicit key per published path, which moves two failures here:
//   - a key whose target the tarball does not contain. That was the wildcard's
//     defect — `@retiregolden/planner-ui/testSupport/samplePlan` resolved
//     happily and then failed in the CONSUMER's build, because `files`
//     excludes it. Now every key is checked against the packed files.
//   - a path that used to resolve through the wildcard and must now be
//     refused with `ERR_PACKAGE_PATH_NOT_EXPORTED`, the clear "not published"
//     answer the wildcard could never give.
// Node's own resolver answers both. `import.meta.resolve` applies the exports
// map WITHOUT loading the module, which is what makes this possible at all:
// the package ships TypeScript, so nothing here could be imported by node.
// Written without template literals so it survives being one.
const exportsSmoke = [
  "import { existsSync, readFileSync } from 'node:fs'",
  "import { fileURLToPath } from 'node:url'",
  '',
  'const fail = (why) => {',
  "  throw new Error('pack smoke FAILED: ' + why)",
  '}',
  '',
  "const manifestPath = fileURLToPath(import.meta.resolve('@retiregolden/planner-ui/package.json'))",
  "const exported = JSON.parse(readFileSync(manifestPath, 'utf8')).exports",
  '',
  '// Every non-null key resolves, and lands on a file the tarball contains.',
  'const problems = []',
  'let resolvedCount = 0',
  'for (const [key, target] of Object.entries(exported)) {',
  "  if (key === './package.json') continue",
  '  if (target === null) continue',
  "  if (typeof target !== 'string') {",
  "    problems.push(key + ' has a conditional target this sweep does not understand')",
  '    continue',
  '  }',
  "  if (key.includes('*')) {",
  "    problems.push(key + ' is a wildcard again: 0.10.0 publishes explicit subpaths only')",
  '    continue',
  '  }',
  "  const specifier = '@retiregolden/planner-ui' + key.slice(1)",
  '  let resolved',
  '  try {',
  '    resolved = import.meta.resolve(specifier)',
  '  } catch (error) {',
  "    problems.push(key + ' -> ' + target + ' does not resolve (' + String(error && error.code) + ')')",
  '    continue',
  '  }',
  '  if (!existsSync(fileURLToPath(resolved))) {',
  "    problems.push(key + ' resolves to ' + target + ', which the tarball does not contain')",
  '    continue',
  '  }',
  '  resolvedCount += 1',
  '}',
  "if (problems.length > 0) fail('exports map: ' + problems.join('; '))",
  '',
  '// The paths `files` excludes, plus one ordinary module that was never a',
  '// published subpath. Each resolved through the old wildcard; each must now',
  '// be refused by name rather than reaching a consumer and failing there.',
  'const mustNotResolve = [',
  "  './testSupport/samplePlan',",
  "  './testSupport/settle',",
  "  './import/documentBenchmark',",
  "  './import/documentCorpus',",
  "  './import/pdfFixtures',",
  "  './report/goldens/example-couple.report-model.json',",
  "  './data/planStore',",
  "  './planner/format.ts',",
  ']',
  'for (const key of mustNotResolve) {',
  "  const specifier = '@retiregolden/planner-ui' + key.slice(1)",
  '  let resolved',
  '  try {',
  '    resolved = import.meta.resolve(specifier)',
  '  } catch (error) {',
  "    if (error && error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') continue",
  "    fail(key + ' must be refused as not exported, got ' + String(error && error.code))",
  '  }',
  "  fail(key + ' still resolves (' + resolved + '); the wildcard must stay gone')",
  '}',
  '',
  '// The null blockers are belt-and-braces — with no wildcard left, an unlisted',
  '// path is already refused — so they only earn their place by being HERE when',
  "// someone reaches for a wildcard again. Assert they are still declared.",
  'const blockers = [',
  "  './import/documentBenchmark',",
  "  './import/documentCorpus',",
  "  './import/pdfFixtures',",
  "  './report/goldens/*',",
  "  './testSupport/*',",
  "  './*',",
  ']',
  'const missingBlockers = blockers.filter((key) => exported[key] !== null)',
  'if (missingBlockers.length > 0) {',
  "  fail('exports map lost its null blockers: ' + missingBlockers.join(', '))",
  '}',
  '',
  "console.log('pack smoke: exports map -> ' + resolvedCount + ' subpaths resolve from the tarball, ' +",
  "  mustNotResolve.length + ' formerly-wildcard paths refused')",
  '',
].join('\n')

const scratchDir = mkdtempSync(join(tmpdir(), 'planner-ui-pack-smoke-'))
try {
  console.log(`pack smoke: packing ${pkgDir} ...`)
  const packed = execFileSync('pnpm', ['pack', '--pack-destination', scratchDir], {
    cwd: pkgDir,
    encoding: 'utf8',
    shell,
  })
    .trim()
    .split('\n')
    .at(-1)
  const tarball = packed.endsWith('.tgz') ? packed.split(/[\\/]/).pop() : packed

  execFileSync('tar', ['-xzf', tarball, 'package/package.json'], { cwd: scratchDir })
  const packedManifest = JSON.parse(readFileSync(join(scratchDir, 'package', 'package.json'), 'utf8'))
  rmSync(join(scratchDir, 'package'), { recursive: true, force: true })
  const packedEngineRange = packedManifest.dependencies?.['@retiregolden/engine']
  if (packedEngineRange !== engineRange) {
    throw new Error(
      `pack smoke FAILED: packed manifest engine range ${JSON.stringify(packedEngineRange)} ` +
        `does not match the declared caret range ${JSON.stringify(engineRange)}`,
    )
  }

  const registryMinimumAvailable =
    engineSourceMode === 'local' ? false : registryHasMinimumEngine()
  if (engineSourceMode === 'registry' && !registryMinimumAvailable) {
    throw new Error(
      `pack smoke FAILED: required registry engine ${minimumEngineVersion} is unavailable; ` +
        'publish the engine minimum before planner-ui',
    )
  }

  const useLocalEngine =
    engineSourceMode === 'local' || (engineSourceMode === 'auto' && !registryMinimumAvailable)
  let engineSpec = minimumEngineVersion
  let engineSource = `registry minimum ${minimumEngineVersion}`
  if (useLocalEngine) {
    const localEnginePackage = JSON.parse(readFileSync(join(enginePkgDir, 'package.json'), 'utf8'))
    if (localEnginePackage.version !== minimumEngineVersion) {
      throw new Error(
        `pack smoke FAILED: registry lacks engine ${minimumEngineVersion}, but local engine is ` +
          `${String(localEnginePackage.version)}; publish the supported minimum or align the local package version`,
      )
    }
    console.log(`pack smoke: packing the exact local engine minimum ${minimumEngineVersion} ...`)
    const packedEngine = execFileSync('pnpm', ['pack', '--pack-destination', scratchDir], {
      cwd: enginePkgDir,
      encoding: 'utf8',
      shell,
    })
      .trim()
      .split('\n')
      .at(-1)
    const engineTarball = packedEngine.endsWith('.tgz')
      ? packedEngine.split(/[\\/]/).pop()
      : packedEngine
    engineSpec = `file:./${engineTarball}`
    engineSource = `local minimum ${minimumEngineVersion}`
  }

  writeFileSync(
    join(scratchDir, 'package.json'),
    JSON.stringify(
      {
        name: 'planner-ui-pack-smoke',
        private: true,
        type: 'module',
        dependencies: {
          '@retiregolden/engine': engineSpec,
          '@retiregolden/planner-ui': `file:./${tarball}`,
          react: '^19.2.7',
          'react-dom': '^19.2.7',
          'react-router': '^8.3.0',
        },
        devDependencies: {
          '@vitejs/plugin-react': '^6.0.1',
          vite: '^8.0.16',
        },
      },
      null,
      2,
    ),
  )
  // pnpm resolves planner-ui's own engine range independently of the root
  // install (npm deduped to the root tarball); pin the transitive resolution
  // to the exact supported minimum under test. pnpm 10 reads overrides from
  // pnpm-workspace.yaml, not package.json.
  writeFileSync(
    join(scratchDir, 'pnpm-workspace.yaml'),
    `overrides:\n  '@retiregolden/engine': '${engineSpec}'\n`,
  )
  writeFileSync(join(scratchDir, 'vite.config.ts'), viteConfig)
  // Sibling fixture avoids an inline HTML string in this script (Semgrep XSS FP
  // when a mkdtemp path sits next to a script-tag literal).
  copyFileSync(join(scriptsDir, 'pack-smoke-index.html'), join(scratchDir, 'index.html'))
  mkdirSync(join(scratchDir, 'src'))
  writeFileSync(join(scratchDir, 'src', 'main.tsx'), mainTsx)
  writeFileSync(join(scratchDir, 'src', 'documentTextSmoke.ts'), documentTextSmoke)
  writeFileSync(join(scratchDir, 'exportsSmoke.mjs'), exportsSmoke)

  console.log(`pack smoke: installing the scratch consumer (${engineSource}, tarball planner-ui) ...`)
  execFileSync('pnpm', ['install', '--ignore-scripts'], {
    cwd: scratchDir,
    stdio: 'inherit',
    shell,
  })

  const installedEngine = JSON.parse(
    readFileSync(join(scratchDir, 'node_modules', '@retiregolden', 'engine', 'package.json'), 'utf8'),
  )
  if (installedEngine.version !== minimumEngineVersion) {
    throw new Error(
      `pack smoke FAILED: expected engine minimum ${minimumEngineVersion}, installed ` +
        `${String(installedEngine.version)}`,
    )
  }

  // Before the build, because a missing or over-wide exports map is a
  // packaging fault this script can name precisely, while the same fault
  // reaches a consumer's build as a module-not-found on someone else's line.
  console.log('pack smoke: exports map from the packed tarball ...')
  process.stdout.write(
    execFileSync('node', ['exportsSmoke.mjs'], {
      cwd: scratchDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  )

  console.log('pack smoke: vite build ...')
  execFileSync('pnpm', ['exec', 'vite', 'build'], { cwd: scratchDir, stdio: 'inherit', shell })

  const assets = readdirSync(join(scratchDir, 'dist', 'assets'))
  const require1 = (pattern, label) => {
    if (!assets.some((name) => pattern.test(name))) {
      throw new Error(`pack smoke FAILED: expected a ${label} in dist/assets (got: ${assets.join(', ')})`)
    }
  }
  // The consumer-side worker bundling is the whole reason this package ships
  // the way it does — assert the worker chunk and the wasm actually landed.
  // One entry serves all four channels (Monte Carlo, optimizer, spending
  // solver, relocation): a bundler builds each worker entry separately, so a
  // second entry here would mean a second copy of the ~740 KiB engine core.
  // Hence `exactly1` over any worker-shaped chunk, not just "at least one
  // planner.worker": a second entry under any name has to fail here, since a
  // consumer's build is where this package's worker story is actually proven.
  const exactly1 = (pattern, label) => {
    const matched = assets.filter((name) => pattern.test(name))
    if (matched.length !== 1) {
      throw new Error(
        `pack smoke FAILED: expected exactly one ${label} in dist/assets, found ${matched.length}` +
          `${matched.length ? ` (${matched.join(', ')})` : ''}. A second worker entry ships another copy ` +
          'of the engine core — see DOCS/operations/bundle-budget.md.',
      )
    }
  }
  exactly1(/\.worker-.*\.js$/, 'Web Worker chunk')
  require1(/^planner\.worker-.*\.js$/, 'planner worker chunk')
  require1(/\.wasm$/, 'HiGHS wasm asset')
  require1(/\.css$/, 'stylesheet')

  // The optional peer, exercised rather than assumed. The browser build above
  // already proved `./document-text` BUILDS with no pdfjs-dist installed; this
  // proves the call it publishes still answers, in a bundle produced from the
  // tarball, with the reason a host can act on.
  console.log('pack smoke: vite build --ssr (document-text without the peer) ...')
  execFileSync('pnpm', ['exec', 'vite', 'build', '--ssr', 'src/documentTextSmoke.ts', '--outDir', 'dist-ssr'], {
    cwd: scratchDir,
    stdio: 'inherit',
    shell,
  })
  const ssrEntry = readdirSync(join(scratchDir, 'dist-ssr')).find((name) => name.endsWith('.js'))
  if (ssrEntry === undefined) {
    throw new Error('pack smoke FAILED: the SSR build emitted no JavaScript entry')
  }
  // stdout captured for the assertion; the child's stderr passes straight
  // through, so a failure inside it is readable rather than swallowed.
  const smokeOutput = execFileSync('node', [join(scratchDir, 'dist-ssr', ssrEntry)], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  if (!smokeOutput.includes('pdfjs_unavailable')) {
    throw new Error(`pack smoke FAILED: document-text smoke did not report pdfjs_unavailable (got: ${smokeOutput})`)
  }
  process.stdout.write(smokeOutput)

  console.log(
    `pack smoke OK: scratch Vite consumer built from ${tarball} against ${engineSource}; ` +
      'worker chunks + wasm emitted; ' +
      'document-text builds and answers without the optional peer',
  )
} finally {
  rmSync(scratchDir, { recursive: true, force: true, maxRetries: 3 })
}
