/**
 * The development-build side of ./howTestedSuites.ts: the same patterns read
 * through `import.meta.glob`, for vitest and the dev server, where nothing
 * injects `__RG_HOW_TESTED__`. `import.meta.glob` takes only literals, so the
 * patterns are repeated here; ./howTestedSuites.test.ts fails if they drift
 * from HOW_TESTED_GLOBS. A production build never imports this module
 * (HowTestedPage reaches it only under `import.meta.env.DEV`), so the ~960
 * test-file paths it names stay out of the shipped chunk.
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
