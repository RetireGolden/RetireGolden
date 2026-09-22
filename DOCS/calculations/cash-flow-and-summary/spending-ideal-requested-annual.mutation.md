# Mutation receipt: spending-ideal-requested-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualExpenseSummary.ts`

```diff
@@ -89,7 +89,7 @@ export function annualExpenseSummary(
       targetSpendingBase +
       input.skippedTargetNominal +
       input.skippedRequiredNominal,
-    idealSpending: idealSpendingBase + input.skippedIdealNominal,
+    idealSpending: targetSpendingBase + idealSpendingBase + input.skippedIdealNominal,
     excessSpending: excessSpendingBase + input.skippedExcessNominal,
     intendedSpending:
       targetSpendingBase +
```

This makes the ideal layer cumulative rather than incremental, publishing $80,000 — the worksheet's first wrong reading. The excess and intended fixtures in the same file fail alongside, because the ideal increment enters both.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualExpenseSummary.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualExpenseSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts (13 tests | 4 failed) 34ms
   ❯ spending-ideal-requested-annual — Annual ideal-layer requested spending (1)
     × isolates the 10000 ideal increment from the worksheet's four summaries 4ms
   ❯ spending-excess-requested-annual — Annual excess-layer requested spending (1)
     × isolates the 5000 excess increment from the worksheet's four summaries 0ms
   ❯ spending-intended-annual — Annual intended spending with no guardrail cut (2)
     × adds the target base and the two increments, each skipped goal once: 85250 1ms
     × equals target plus the two increments on a real projection row 24ms

 Test Files  1 failed (1)
      Tests  4 failed | 9 passed (13)

  Transform  transforming modules took 2.18s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-ideal-requested-annual — Annual ideal-layer requested spending > isolates the 10000 ideal increment from the worksheet's four summaries
AssertionError: idealSpending 80000 is not within {"abs":0.005} of the worksheet's 10000: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts:299:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-excess-requested-annual — Annual excess-layer requested spending > isolates the 5000 excess increment from the worksheet's four summaries
AssertionError: idealSpending 80000 is not within {"abs":0.005} of the worksheet's 10000: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts:337:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-intended-annual — Annual intended spending with no guardrail cut > adds the target base and the two increments, each skipped goal once: 85250
AssertionError: idealSpending 77500 is not within {"abs":0.005} of the worksheet's 7500: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts:411:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-intended-annual — Annual intended spending with no guardrail cut > equals target plus the two increments on a real projection row
AssertionError: intendedSpending against its own published layers 79500 is not within {"abs":0.005} of the worksheet's 153500: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts:423:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualExpenseSummary.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualExpenseSummary.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
