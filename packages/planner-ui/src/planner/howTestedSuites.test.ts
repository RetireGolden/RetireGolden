// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { globSync, readFileSync } from 'node:fs'
// @ts-expect-error -- node builtins in a node-env test; the app tsconfig omits node types
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { howTestedSummaryFromGlob } from './howTestedGlob'
import {
  HOW_TESTED_GLOBS,
  howTestedSummaryFromFileGlob,
  howTestedSummaryFromPaths,
  NO_SUITE_DATA,
  suiteName,
} from './howTestedSuites'

/**
 * "How RetireGolden is tested" prints counts a production build injects
 * (app/vite.config.ts: fs.globSync over HOW_TESTED_GLOBS) and a development
 * build globs (./howTestedGlob.ts: import.meta.glob). These pin the two to
 * each other, so the shipped page prints what the source tree holds.
 */

const here: string = fileURLToPath(new URL('.', import.meta.url))

/** Exactly what app/vite.config.ts computes: fs.globSync, rooted at the page's directory. */
function injectedSummary() {
  return howTestedSummaryFromFileGlob((pattern) => globSync(pattern, { cwd: here }) as string[])
}

describe('How RetireGolden is tested: build-time counts', () => {
  it('injects the counts and suite names the import.meta.glob branch derives', () => {
    const injected = injectedSummary()
    const globbed = howTestedSummaryFromGlob()
    expect(injected).toEqual(globbed)
    // Sanity floors, so an equal pair of empty globs cannot pass.
    expect(injected.externalOracleSuites).toHaveLength(8)
    expect(injected.goldenSuiteCount).toBeGreaterThan(injected.externalOracleSuites.length)
    expect(injected.testFileCount).toBeGreaterThan(900)
  })

  it('keeps the eight external-oracle suite names, in path order', () => {
    expect(injectedSummary().externalOracleSuites).toEqual([
      'rmd',
      'pia from earnings',
      'aca',
      'federal tax',
      'federal tax social security',
      'medicare',
      'state tax',
      'ss analysis',
    ])
  })

  it('injects nothing that names a test file', () => {
    const json = JSON.stringify(injectedSummary())
    expect(json).not.toMatch(/\.test\.tsx?/)
    expect(json).not.toMatch(/\.\.\//)
  })

  it('globs the shared list: howTestedGlob.ts repeats HOW_TESTED_GLOBS literally, in order', () => {
    // import.meta.glob takes only literals, so the development branch spells
    // the patterns out; any drift from the shared list fails here.
    const source: string = readFileSync(new URL('./howTestedGlob.ts', import.meta.url), 'utf8')
    const calls = [...source.matchAll(/import\.meta\.glob\(\s*\[([^\]]*)\]/g)].map((match) =>
      [...match[1]!.matchAll(/'([^']+)'/g)].map((literal) => literal[1]),
    )
    expect(calls).toEqual([HOW_TESTED_GLOBS.externalOracle, HOW_TESTED_GLOBS.golden, HOW_TESTED_GLOBS.all])
  })
})

describe('howTestedSummaryFromPaths', () => {
  it('orders by absolute path, dedupes, and accepts either slash direction', () => {
    const summary = howTestedSummaryFromPaths({
      externalOracle: [
        './zeta.external.golden.test.ts',
        '..\\..\\..\\engine\\src\\tax\\federalTax.external.golden.test.ts',
        '../../../engine/src/tax/federalTax.external.golden.test.ts',
        '../planner/alpha.external.golden.test.ts',
      ],
      golden: ['a.golden.test.ts', 'a.golden.test.ts'],
      all: ['../node_modules/x/y.test.ts', '../.cache/z.test.ts', '../a.test.ts'],
    })
    // packages/engine/... sorts before packages/planner-ui/...
    expect(summary.externalOracleSuites).toEqual(['federal tax', 'alpha', 'zeta'])
    expect(summary.goldenSuiteCount).toBe(1)
    // node_modules and dot-directories are skipped, as import.meta.glob skips them.
    expect(summary.testFileCount).toBe(1)
  })

  it('names suites in plain words and has an empty summary for a tree with no tests', () => {
    expect(suiteName('../../../engine/src/tax/federalTaxSocialSecurity.external.golden.test.ts')).toBe(
      'federal tax social security',
    )
    expect(howTestedSummaryFromPaths({ externalOracle: [], golden: [], all: [] })).toEqual(NO_SUITE_DATA)
  })
})
