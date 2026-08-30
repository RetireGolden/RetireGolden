/**
 * Drift guard for the `lazyRoutes.ts` loader table.
 *
 * `preloadLazyRoutes` only works because its dynamic imports resolve to the
 * SAME module ids as the `lazy()` bindings in `routes/lazyPages.tsx` and
 * `routes/planPages.tsx`. That is a hand-copied mirror across three files,
 * and the failure mode is silent: rename a screen or repoint a binding and
 * the table warms one module while `lazy()` still pays the cold cost for
 * another. Every preloading `beforeAll` stays green, and the ~6 s cold
 * evaluation comes back inside a 5 s test timeout — the exact order-dependent
 * failure the helper exists to prevent, now wearing a preload that looks like
 * protection.
 *
 * So compare the specifiers rather than trusting the comment. This reads the
 * three files as text and resolves each `import('…')` target against its own
 * directory: the relative prefixes differ on purpose (`./PlanRoutes` from
 * `routes/`, `../routes/PlanRoutes` from `testSupport/`), and resolving is
 * what shows they name one file. Static text, not execution, so the guard
 * costs nothing and cannot itself be defeated by a warm module cache.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const BINDING_MODULES = [resolve(here, '../routes/lazyPages.tsx'), resolve(here, '../routes/planPages.tsx')]
const LOADER_MODULE = resolve(here, './lazyRoutes.ts')

/** Block and line comments, so prose mentioning `import(` cannot be counted. */
const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
const DYNAMIC_IMPORT = /import\(\s*['"]([^'"]+)['"]\s*\)/g

/**
 * Every `import('…')` target in `file`, resolved to an absolute path so two
 * differently-spelled specifiers for one module compare equal. Extensions are
 * absent on both sides (source omits them), so they cancel out.
 */
function dynamicImportTargets(file: string): string[] {
  const source = readFileSync(file, 'utf8').replace(COMMENTS, '')
  const dir = dirname(file)
  return [...source.matchAll(DYNAMIC_IMPORT)].map((match) => resolve(dir, match[1])).sort()
}

describe('lazyRoutes loader table', () => {
  it('mirrors every lazy() binding, so a preload warms the module lazy() will import', () => {
    const bindings = BINDING_MODULES.flatMap(dynamicImportTargets).sort()
    const loaders = dynamicImportTargets(LOADER_MODULE)

    // Guard the guard: a regex that matched nothing would make the comparison
    // below trivially pass and quietly stop protecting anything.
    expect(bindings.length).toBeGreaterThan(0)
    expect(loaders.length).toBeGreaterThan(0)

    // Reported as paths rather than counts: a mismatch should name the screen
    // whose specifier moved, not just say a number changed.
    expect(loaders).toStrictEqual(bindings)
  })
})
