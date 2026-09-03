import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import viteConfigText from '../vite.config.ts?raw'

/**
 * vite.config.ts hard-codes bare filenames for the engine modules its
 * Rolldown `codeSplitting` groups (annualProjectionCodeSplitting) match by
 * exact path. A rename or move there does not fail the build on its own —
 * the module just silently falls out of its chunk
 * (DOCS/operations/bundle-budget.md) — so vite.config.ts already throws at
 * config-load time if one of these no longer resolves
 * (assertProjectionInternalChunkModulesExist). This test re-checks the same
 * list, read from source text rather than by importing the config (which
 * would run the PWA/build setup), so a rename fails `pnpm test` too, without
 * needing a full build.
 */
const engineProjectionInternalDir = fileURLToPath(
  new URL('../../packages/engine/src/projection/internal', import.meta.url),
)

// Every bare `'someModule.ts'` string literal in vite.config.ts names one of
// the chunk-grouped modules — the config carries no other bare .ts filename
// literal (every other path in the file is written with a leading '/').
function chunkModuleNames() {
  return [...viteConfigText.matchAll(/'([A-Za-z][\w-]*\.ts)'/g)].map((m) => m[1])
}

describe('vite.config.ts projection/internal chunk module list', () => {
  it('names at least the modules the desloppify audit found (14) — a shrinking list is worth a second look', () => {
    expect(chunkModuleNames().length).toBeGreaterThanOrEqual(14)
  })

  it('every named module still exists under packages/engine/src/projection/internal/', () => {
    const names = chunkModuleNames()
    expect(names.length).toBeGreaterThan(0)

    const missing = names.filter((name) => !existsSync(`${engineProjectionInternalDir}/${name}`))
    expect(missing, `missing under packages/engine/src/projection/internal/: ${missing.join(', ')}`).toEqual([])
  })
})
