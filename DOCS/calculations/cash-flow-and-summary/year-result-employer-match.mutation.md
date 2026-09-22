# Mutation receipt: year-result-employer-match

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts`

```diff
@@ -737,7 +737,6 @@
     const match415cKey = employerPlanScopeKey(ownerId, account)
     const usedSoFar = addition415cUsed.get(match415cKey) ?? 0
     const remaining415cLimit = Math.max(0, limit415c - usedSoFar)
-    matchVal = Math.min(matchVal, remaining415cLimit)
     if (matchVal <= 0) continue
 
     const balanceBefore = shadowBalances[balanceIndex]!
```

This drops the IRC §415(c) cap on the raw match, publishing $49,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (simulate.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/simulate.evidence.test.ts (9 tests | 1 failed) 56ms
   ❯ year-result-employer-match — Annual employer match under the pay cap and the annual-additions limit (1)
     × caps the 49000 raw match at the 47500 of §415(c) room left after the deferral 6ms

 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)

  Transform  transforming modules took 2.37s · 45% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/simulate.evidence.test.ts > year-result-employer-match — Annual employer match under the pay cap and the annual-additions limit > caps the 49000 raw match at the 47500 of §415(c) room left after the deferral
AssertionError: employerMatch 49000 is not within {"abs":0.005} of the worksheet's 47500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/simulate.evidence.test.ts:35:5
     33|     withinTolerance(actual, target, tolerance),
     34|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     35|   ).toBe(true)
       |     ^
     36| }
     37|
 ❯ src/projection/simulate.evidence.test.ts:416:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
