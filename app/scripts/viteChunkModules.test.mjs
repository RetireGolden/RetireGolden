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
 * (assertProjectionInternalChunkModulesExist). Because that config file
 * doubles as this workspace's Vitest config, loading it to run *any* app
 * test already executes that check, so a rename already fails `pnpm test`
 * on its own, with no help from this file.
 *
 * What this file adds on top: an independent existence check, parsed from
 * source text (`?raw`, so nothing here imports the config and re-runs the
 * PWA/build setup) rather than trusting the same in-memory array the
 * assertion reads from, and a floor on the list's length. The floor catches
 * a module quietly dropped from the groups — as opposed to renamed — which
 * would leave every *remaining* name still resolving and so would not trip
 * assertProjectionInternalChunkModulesExist() at all.
 */
const engineProjectionInternalDir = fileURLToPath(
  new URL('../../packages/engine/src/projection/internal', import.meta.url),
)

// Scoped to the four ANNUAL_PROJECTION_*_MODULE_NAME(S) declarations the
// codeSplitting groups actually match against, not the whole file, so a
// bare '*.ts' string anywhere else in vite.config.ts (a comment, an
// unrelated literal) can't be mistaken for a chunk-grouped module and a
// stray leftover reference can't mask a real removal.
const CHUNK_MODULE_CONST_NAMES =
  /const ANNUAL_PROJECTION_(?:SETTLEMENT_MODULE_NAME|FUNDING_CLOSE_MODULE_NAME|PUBLICATION_MODULE_NAME|KERNEL_MODULE_NAMES)\s*=\s*(\[[^\]]*\]|'[^']*')/g

function chunkModuleNames() {
  const names = []
  for (const declaration of viteConfigText.matchAll(CHUNK_MODULE_CONST_NAMES)) {
    for (const literal of declaration[1].matchAll(/'([A-Za-z][\w-]*\.ts)'/g)) {
      names.push(literal[1])
    }
  }
  return names
}

// The count of chunk-grouped modules as of the last time this floor was
// reviewed. Not a magic number to preserve for its own sake — a drop below
// it means a module left the code-splitting groups, which is worth a
// second look even when every remaining name still resolves.
const KNOWN_CHUNK_MODULE_COUNT = 14

describe('vite.config.ts projection/internal chunk module list', () => {
  it('names at least the currently chunk-grouped modules — a shrinking list is worth a second look', () => {
    expect(chunkModuleNames().length).toBeGreaterThanOrEqual(KNOWN_CHUNK_MODULE_COUNT)
  })

  it('every named module still exists under packages/engine/src/projection/internal/', () => {
    const names = chunkModuleNames()
    expect(names.length).toBeGreaterThan(0)

    const missing = names.filter((name) => !existsSync(`${engineProjectionInternalDir}/${name}`))
    expect(missing, `missing under packages/engine/src/projection/internal/: ${missing.join(', ')}`).toEqual([])
  })
})
