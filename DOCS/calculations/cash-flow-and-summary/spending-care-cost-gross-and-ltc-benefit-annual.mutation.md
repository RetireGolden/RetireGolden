# Mutation receipt: spending-care-cost-gross-and-ltc-benefit-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts`

```diff
@@ -128,9 +128,6 @@
         12 *
         Math.pow(1 + rider, input.year - input.startYear)
       // The first episode year bears the elimination period out of pocket.
-      if (yearsIntoEpisode === 0) {
-        cap *= Math.max(0, 1 - policy.eliminationPeriodDays / 365)
-      }
       const pay = Math.min(remaining, cap)
       if (pay > 0) {
         ltcBenefit += pay
```

This drops the first-year elimination-period haircut on the policy cap, publishing a benefit of $66,150 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualDebtAndLongTermCare.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts (3 tests | 1 failed) 29ms
   ❯ spending-care-cost-gross-and-ltc-benefit-annual — Annual gross care cost and the LTC benefit against it (1)
     × charges 72600 of gross care and reimburses 49839.0410958904 after the elimination haircut 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)

  Transform  transforming modules took 2.54s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts > spending-care-cost-gross-and-ltc-benefit-annual — Annual gross care cost and the LTC benefit against it > charges 72600 of gross care and reimburses 49839.0410958904 after the elimination haircut
AssertionError: expenses.ltcBenefit 66150 is not within {"abs":0.005} of the worksheet's 49839.0410958904: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:29:5
     27|     withinTolerance(actual, target, tolerance),
     28|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     29|   ).toBe(true)
       |     ^
     30| }
     31|
 ❯ src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:221:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
