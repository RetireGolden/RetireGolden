/**
 * The development-build side of ./howTestedSuites.ts: the same patterns read
 * through `import.meta.glob`, for vitest and the dev server, where nothing
 * injects `__RG_HOW_TESTED__`. `import.meta.glob` takes only literals, so the
 * patterns are repeated here; ./howTestedSuites.test.ts fails if they drift
 * from HOW_TESTED_GLOBS.
 *
 * This module is in every build's source graph: HowTestedPage imports it
 * statically. In a production build its only call sits in the
 * `import.meta.env.DEV` branch, which Vite folds to false, so tree-shaking
 * drops the call, this module and the ~960 test-file paths it would name. The
 * backstop is the bundle budget: app/scripts/check-bundle-budget.mjs fails the
 * build if any chunk in dist names a `*.test.ts(x)` file
 * (chunksNamingTestFiles), so the paths cannot reach the shipped app unnoticed.
 *
 * Sibling-workspace globs (engine, app harness tests) resolve when this file
 * is built inside the RetireGolden monorepo. In an external consumer of the
 * published package they match nothing (the tarball ships without test files),
 * so the counts degrade to zero rather than lie.
 */

import { howTestedSummaryFromPaths, type HowTestedSummary } from './howTestedSuites'

export function howTestedSummaryFromGlob(): HowTestedSummary {
  return howTestedSummaryFromPaths({
    externalOracle: Object.keys(
      import.meta.glob(['../**/*.external.golden.test.ts', '../../../engine/src/**/*.external.golden.test.ts']),
    ),
    golden: Object.keys(import.meta.glob(['../**/*.golden.test.ts', '../../../engine/src/**/*.golden.test.ts'])),
    all: Object.keys(
      import.meta.glob([
        '../**/*.test.{ts,tsx}',
        '../../../engine/src/**/*.test.ts',
        '../../../../app/src/**/*.test.{ts,tsx}',
      ]),
    ),
  })
}
