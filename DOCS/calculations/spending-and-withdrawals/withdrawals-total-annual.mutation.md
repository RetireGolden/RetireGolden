# Mutation receipt: withdrawals-total-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualWithdrawalPlanning.ts`

```diff
@@ -306,8 +306,7 @@ export function annualWithdrawalPlan(
     byCategory.cash +
     byCategory.taxable +
     byCategory.traditional +
-    byCategory.roth +
-    byCategory.hsa
+    byCategory.roth
   return {
     byCategory,
     byAccountId,
```

This drops the HSA category from the withdrawal total, publishing $40,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualFundingApplicationAndClosePhase.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts (6 tests | 1 failed) 41ms
   ❯ withdrawals-total-annual — Annual withdrawal total (1)
     × sums the five categories to 42000 8ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)

  Transform  transforming modules took 2.12s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > withdrawals-total-annual — Annual withdrawal total > sums the five categories to 42000
AssertionError: withdrawals.total 40000 is not within {"abs":0.005} of the worksheet's 42000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:25:5
     23|     withinTolerance(actual, expected, tolerance),
     24|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     25|   ).toBe(true)
       |     ^
     26| }
     27|
 ❯ src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:288:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualWithdrawalPlanning.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualWithdrawalPlanning.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
