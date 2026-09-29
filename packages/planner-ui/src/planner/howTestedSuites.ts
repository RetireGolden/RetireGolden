/**
 * What "How RetireGolden is tested" (./HowTestedPage.tsx) counts, in one list.
 *
 * The page states how many external-oracle suites, golden suites and test
 * files the source tree holds. Two things compute those numbers from the SAME
 * patterns below, relative to this directory:
 *
 *  - a production build of the app: app/vite.config.ts globs the tree with
 *    `fs.globSync` at build time (`howTestedSummaryFromFileGlob`) and injects the
 *    summary as `__RG_HOW_TESTED__`, so the shipped chunk carries three
 *    numbers and eight names instead of ~960 test-file paths;
 *  - a development build (vitest, the dev server): ./howTestedGlob.ts reads the
 *    same patterns through `import.meta.glob`, which only takes literals, so it
 *    spells them out again. ./howTestedSuites.test.ts pins those literals to
 *    this list and the two summaries to each other.
 *
 * Pure on purpose: app/vite.config.ts imports this file under Node.
 */

/** Test-file patterns per count, relative to packages/planner-ui/src/planner/. */
export const HOW_TESTED_GLOBS = {
  /** Suites checked against third-party implementations that share no code with RetireGolden. */
  externalOracle: ['../**/*.external.golden.test.ts', '../../../engine/src/**/*.external.golden.test.ts'],
  /** All golden suites (fixed expected-value fixtures), external and internal. */
  golden: ['../**/*.golden.test.ts', '../../../engine/src/**/*.golden.test.ts'],
  /** Every automated test file in the source tree (planner-ui + engine + app harness). */
  all: ['../**/*.test.{ts,tsx}', '../../../engine/src/**/*.test.ts', '../../../../app/src/**/*.test.{ts,tsx}'],
} as const

export type HowTestedGroup = keyof typeof HOW_TESTED_GLOBS

/** What the page prints: the external-oracle suite names and two counts. */
export interface HowTestedSummary {
  /** Display names, e.g. "federal tax social security", in path order. */
  externalOracleSuites: readonly string[]
  goldenSuiteCount: number
  testFileCount: number
}

/** A build with no test files to count (e.g. from the published tarball). */
export const NO_SUITE_DATA: HowTestedSummary = { externalOracleSuites: [], goldenSuiteCount: 0, testFileCount: 0 }

/** "…/federalTaxSocialSecurity.external.golden.test.ts" → "federal tax social security". */
export function suiteName(path: string): string {
  const base = path.split('/').pop()!.replace(/\.external\.golden\.test\.ts$/, '')
  return base.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
}

/** This directory, as the segments under the repository root. */
const HERE = ['packages', 'planner-ui', 'src', 'planner']

/**
 * A pattern-relative path as a repository-relative one. Every path shares the
 * repository root, so ordering by this is ordering by absolute path, which is
 * how `import.meta.glob` orders its keys.
 */
function repositoryPath(relative: string): string {
  const out = [...HERE]
  for (const segment of relative.split('/')) {
    if (segment === '..') out.pop()
    else if (segment !== '.' && segment !== '') out.push(segment)
  }
  return out.join('/')
}

/**
 * `import.meta.glob` skips node_modules and dot-directories; a filesystem glob
 * may not, so both sides drop them here.
 */
function globbable(relative: string): boolean {
  return relative
    .split('/')
    .every((segment) => segment === '.' || segment === '..' || (segment !== 'node_modules' && !segment.startsWith('.')))
}

/**
 * Summarise pattern-relative paths (either slash direction) per group. Paths
 * are deduplicated and ordered by absolute path, so an `import.meta.glob` key
 * list and a filesystem glob of the same patterns give the same summary.
 */
export function howTestedSummaryFromPaths(paths: Record<HowTestedGroup, readonly string[]>): HowTestedSummary {
  const normalized = (group: HowTestedGroup) =>
    [...new Set(paths[group].map((path) => path.replaceAll('\\', '/')).filter(globbable))].sort((a, b) => {
      const left = repositoryPath(a)
      const right = repositoryPath(b)
      return left < right ? -1 : left > right ? 1 : 0
    })
  return {
    externalOracleSuites: normalized('externalOracle').map(suiteName),
    goldenSuiteCount: normalized('golden').length,
    testFileCount: normalized('all').length,
  }
}

/**
 * The build-time side: every HOW_TESTED_GLOBS pattern through a filesystem
 * glob rooted at this directory (app/vite.config.ts passes `fs.globSync` with
 * that `cwd`), summarised exactly as the `import.meta.glob` keys are.
 */
export function howTestedSummaryFromFileGlob(glob: (pattern: string) => readonly string[]): HowTestedSummary {
  const paths = (group: HowTestedGroup) => HOW_TESTED_GLOBS[group].flatMap((pattern) => glob(pattern))
  return howTestedSummaryFromPaths({
    externalOracle: paths('externalOracle'),
    golden: paths('golden'),
    all: paths('all'),
  })
}
