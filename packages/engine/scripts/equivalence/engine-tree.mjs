/**
 * Loads an engine SOURCE TREE — any directory that looks like
 * `packages/engine/src` — straight from plain Node, with no build step, no
 * vitest and no bundler.
 *
 * WHY THIS EXISTS. The differential check needs to run two different engine
 * source trees against the same corpus. Every earlier throwaway harness did
 * that with a standalone vitest config, because it ran as a `*.test.ts`. A
 * committed `.mjs` script does not need vitest at all: Node 24 strips
 * TypeScript types natively, and `scripts/typescript-source-resolution.mjs`
 * already maps a NodeNext `./x.js` specifier onto the `./x.ts` that emitted it.
 * This module adds the three rules that hook does not cover:
 *
 *   1. `@retiregolden/engine` and `@retiregolden/engine/<sub>` resolve into the
 *      CHOSEN tree (`<src>/index.ts`, `<src>/<sub>.ts`, `<src>/<sub>/index.ts`)
 *      rather than through the workspace link. This is what makes "same corpus,
 *      two trees" a one-argument change.
 *   2. Extensionless relative specifiers (`./buildContext`) resolve to `.ts` /
 *      `/index.ts`. The engine itself never writes those — NodeNext forbids it —
 *      but the planner-ui example builders do, and the `examples` corpus tier
 *      reads them.
 *   3. Bare dependencies (`zod`, `highs`) resolve from THIS package rather than
 *      from beside the chosen tree. That is what lets a tree materialized by
 *      `git archive` — which has no `node_modules` at all — run at all, and it
 *      pins both trees to one dependency copy so a dependency difference can
 *      never be mistaken for an engine difference. The resolved `zod` version
 *      goes in the capture manifest, because holding dependencies at the
 *      current install is a deliberate choice and must not be silent.
 *
 * Rule 3 is behaviour-affecting by construction, so it is measured rather than
 * assumed: capturing the worktree tree with and without a `node_modules`
 * beside it must produce the same dump hash.
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { describeTree, normalizeDir } from './describe-tree.mjs'

// Registers the shared relative `./x.js` -> `./x.ts` hook. Imported for its
// side effect, exactly as `verify-quotes.mjs` does.
import '../typescript-source-resolution.mjs'

const require = createRequire(import.meta.url)

const ENGINE_PACKAGE = '@retiregolden/engine'
const TYPESCRIPT_PARENT = /\.(?:ts|mts|cts|tsx)$/u
/** Extension order tried for a specifier that names no extension. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

export { describeTree }

/** The tree currently selected. Set once, before the first engine import. */
let engineSrc = null
let hookRegistered = false

/**
 * Resolve `<base>` as a module file: itself if it exists, else `<base><ext>`,
 * else `<base>/index<ext>`. Returns a file URL string, or null.
 * @param {string} base absolute POSIX-slashed path, no extension assumed
 * @returns {string | null}
 */
function resolveSourceFile(base) {
  if (/\.[cm]?[jt]sx?$/u.test(base) && existsSync(base)) return pathToFileURL(base).href
  for (const extension of SOURCE_EXTENSIONS) {
    if (existsSync(base + extension)) return pathToFileURL(base + extension).href
  }
  for (const extension of SOURCE_EXTENSIONS) {
    const indexPath = `${base}/index${extension}`
    if (existsSync(indexPath)) return pathToFileURL(indexPath).href
  }
  return null
}

/**
 * Resolve a bare dependency from THIS package's install. `import.meta.resolve`
 * is used first so ESM export conditions are honoured exactly as they would be
 * for a normal import here; `require.resolve` is the fallback for a dependency
 * that publishes no ESM entry.
 * @param {string} specifier
 * @returns {string | null}
 */
function resolveOwnDependency(specifier) {
  // RE-ENTRANCY GUARD, and it is load-bearing rather than defensive.
  // `import.meta.resolve` runs the registered resolve hooks, so without this
  // the hook below would call back into itself for the same specifier and hang
  // the process — measured, on the first run of this tool. With the flag set,
  // the inner call falls through to `nextResolve` against THIS module's URL,
  // which is exactly the "resolve it from the tool's own package" rule.
  if (resolvingOwnDependency) return null
  resolvingOwnDependency = true
  try {
    return import.meta.resolve(specifier)
  } catch {
    try {
      return pathToFileURL(require.resolve(specifier)).href
    } catch {
      return null
    }
  } finally {
    resolvingOwnDependency = false
  }
}
let resolvingOwnDependency = false

/**
 * Select the engine source tree and register the resolve hook. Must be called
 * BEFORE the first `loadEngine()` — the hook cannot retroactively affect a
 * module the loader has already resolved.
 * @param {string} dir a `packages/engine/src`-shaped directory
 * @returns {string} the normalized directory
 */
export function configureEngineTree(dir) {
  const normalized = normalizeDir(dir)
  if (!existsSync(`${normalized}/projection/simulate.ts`)) {
    throw new Error(`not an engine source tree (no projection/simulate.ts): ${normalized}`)
  }
  if (engineSrc !== null && engineSrc !== normalized) {
    throw new Error(
      `engine tree already fixed to ${engineSrc}; one tree per process (module state is cached)`,
    )
  }
  engineSrc = normalized
  if (hookRegistered) return engineSrc
  hookRegistered = true
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === ENGINE_PACKAGE || specifier.startsWith(`${ENGINE_PACKAGE}/`)) {
        const rest = specifier === ENGINE_PACKAGE ? 'index' : specifier.slice(ENGINE_PACKAGE.length + 1)
        const url = resolveSourceFile(`${engineSrc}/${rest}`)
        if (url === null) throw new Error(`cannot resolve "${specifier}" inside ${engineSrc}`)
        return { url, shortCircuit: true }
      }
      const parentURL = context.parentURL
      const fromTypeScript = parentURL !== undefined && TYPESCRIPT_PARENT.test(parentURL)
      if (fromTypeScript && (specifier.startsWith('./') || specifier.startsWith('../'))) {
        // Extensionless only: an explicit `./x.js` is the shared hook's job.
        if (!/\.[cm]?[jt]sx?$/u.test(specifier)) {
          const base = fileURLToPath(new URL(specifier, parentURL)).split('\\').join('/')
          const url = resolveSourceFile(base)
          if (url !== null) return { url, shortCircuit: true }
        }
        return nextResolve(specifier, context)
      }
      const bare =
        !specifier.startsWith('.') &&
        !specifier.startsWith('/') &&
        !specifier.startsWith('node:') &&
        !specifier.startsWith('file:') &&
        !specifier.startsWith('data:')
      if (bare) {
        const url = resolveOwnDependency(specifier)
        if (url !== null) return { url, shortCircuit: true }
      }
      return nextResolve(specifier, context)
    },
  })
  return engineSrc
}

/** @returns {string} the configured tree; throws if none was configured. */
export function engineTree() {
  if (engineSrc === null) throw new Error('configureEngineTree() has not been called')
  return engineSrc
}

/**
 * Import the engine surface the tool uses. Everything resolves through the
 * configured tree, so the caller never writes a path.
 */
export async function loadEngine() {
  const src = engineTree()
  const [plan, simulate, federalTax, stateTax] = await Promise.all([
    import(`${ENGINE_PACKAGE}/model/plan`),
    import(`${ENGINE_PACKAGE}/projection/simulate`),
    import(`${ENGINE_PACKAGE}/tax/federalTax`),
    import(`${ENGINE_PACKAGE}/tax/stateTax`),
  ])
  return {
    src,
    parsePlan: plan.parsePlan,
    createEmptyPlan: plan.createEmptyPlan,
    simulatePlan: simulate.simulatePlan,
    combineTaxCalculators: federalTax.combineTaxCalculators,
    createFederalTaxCalculator: federalTax.createFederalTaxCalculator,
    createStateTaxCalculator: stateTax.createStateTaxCalculator,
  }
}

/** Resolved version of the dependency copy both trees are pinned to. */
export function resolvedDependencyVersions() {
  const out = {}
  for (const name of ['zod', 'highs']) {
    try {
      out[name] = require(`${name}/package.json`).version
    } catch {
      out[name] = null
    }
  }
  return out
}
