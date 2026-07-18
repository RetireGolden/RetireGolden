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
 * Note: @retiregolden/engine is installed from the npm registry at the
 * version range the package declares, exactly as a consumer would get it.
 * Run from anywhere: `node packages/planner-ui/scripts/pack-smoke.mjs`.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const pkgDir = resolve(scriptsDir, '..')
const shell = process.platform === 'win32' // npm/npx are .cmd files on Windows

const viteConfig = `
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@retiregolden/planner-ui'],
    include: ['@retiregolden/planner-ui > highs', '@retiregolden/planner-ui > recharts'],
  },
})
`

const mainTsx = `
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useRoutes } from 'react-router-dom'
import '@retiregolden/planner-ui/index.css'
// The 0.2.0 host surface: the seam, the route groups, and the stable
// plan-format subpath must all resolve from the tarball's exports map.
import {
  PlannerApp,
  PlanStoreProvider,
  indexedDbPlanStore,
  plannerContentRoutes,
  plannerWorkspaceRoutes,
  type PlanStore,
} from '@retiregolden/planner-ui'
import { parseV2Backup, serializeV2Backup } from '@retiregolden/planner-ui/plan-format'

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

console.debug(parseV2Backup(serializeV2Backup([])).ok, WorkspaceOnlyHost.name, PlanStoreProvider.name)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PlannerApp planStore={hostStore} />
    </BrowserRouter>
  </StrictMode>,
)
`

const scratchDir = mkdtempSync(join(tmpdir(), 'planner-ui-pack-smoke-'))
try {
  console.log(`pack smoke: packing ${pkgDir} ...`)
  const tarball = execFileSync('npm', ['pack', '--pack-destination', scratchDir], {
    cwd: pkgDir,
    encoding: 'utf8',
    shell,
  })
    .trim()
    .split('\n')
    .at(-1)

  writeFileSync(
    join(scratchDir, 'package.json'),
    JSON.stringify(
      {
        name: 'planner-ui-pack-smoke',
        private: true,
        type: 'module',
        dependencies: {
          '@retiregolden/planner-ui': `file:./${tarball}`,
          react: '^19.2.6',
          'react-dom': '^19.2.6',
          'react-router-dom': '^7.18.0',
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
  writeFileSync(join(scratchDir, 'vite.config.ts'), viteConfig)
  // Sibling fixture avoids an inline HTML string in this script (Semgrep XSS FP
  // when a mkdtemp path sits next to a script-tag literal).
  copyFileSync(join(scriptsDir, 'pack-smoke-index.html'), join(scratchDir, 'index.html'))
  mkdirSync(join(scratchDir, 'src'))
  writeFileSync(join(scratchDir, 'src', 'main.tsx'), mainTsx)

  console.log('pack smoke: installing the scratch consumer (registry engine, tarball planner-ui) ...')
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts'], {
    cwd: scratchDir,
    stdio: 'inherit',
    shell,
  })

  console.log('pack smoke: vite build ...')
  execFileSync('npx', ['vite', 'build'], { cwd: scratchDir, stdio: 'inherit', shell })

  const assets = readdirSync(join(scratchDir, 'dist', 'assets'))
  const require1 = (pattern, label) => {
    if (!assets.some((name) => pattern.test(name))) {
      throw new Error(`pack smoke FAILED: expected a ${label} in dist/assets (got: ${assets.join(', ')})`)
    }
  }
  // The consumer-side worker bundling is the whole reason this package ships
  // the way it does — assert every worker chunk and the wasm actually landed.
  require1(/monteCarlo\.worker-.*\.js$/, 'Monte Carlo worker chunk')
  require1(/optimize\.worker-.*\.js$/, 'optimizer worker chunk')
  require1(/spendingSolve\.worker-.*\.js$/, 'spending-solver worker chunk')
  require1(/relocation\.worker-.*\.js$/, 'relocation worker chunk')
  require1(/\.wasm$/, 'HiGHS wasm asset')
  require1(/\.css$/, 'stylesheet')

  console.log(`pack smoke OK: scratch Vite consumer built from ${tarball}; worker chunks + wasm emitted`)
} finally {
  rmSync(scratchDir, { recursive: true, force: true, maxRetries: 3 })
}
