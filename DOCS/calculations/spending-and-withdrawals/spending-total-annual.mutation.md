# Mutation receipt: spending-total-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualExpenseSummary.ts`

```diff
@@ -107,7 +107,7 @@ export function annualExpenseSummary(
       input.propertyCosts +
       input.healthcare +
       input.insurancePremiums +
-      input.careCost -
+      input.careCost +
       input.ltcBenefit,
   }
 
```

This adds the LTC benefit instead of subtracting it, publishing $122,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualExpenseSummary.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualExpenseSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts (13 tests | 1 failed) 31ms
   ❯ spending-total-annual — Annual net expense total (2)
     × nets the eight members to 94000 and ignores the factor and the request 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)

  Transform  transforming modules took 2.18s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-total-annual — Annual net expense total > nets the eight members to 94000 and ignores the factor and the request
AssertionError: expenses.total 122000 is not within {"abs":0.005} of the worksheet's 94000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualExpenseSummary.evidence.test.ts:62:5
     60|     withinTolerance(actual, target, tolerance),
     61|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     62|   ).toBe(true)
       |     ^
     63| }
     64|
 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts:492:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualExpenseSummary.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualExpenseSummary.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
