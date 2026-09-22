# Mutation receipt: spending-target-requested-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualExpenseSummary.ts`

```diff
@@ -86,9 +86,7 @@ export function annualExpenseSummary(
     requiredSpending:
       requiredSpendingBase + input.skippedRequiredNominal,
     targetSpending:
-      targetSpendingBase +
-      input.skippedTargetNominal +
-      input.skippedRequiredNominal,
+      targetSpendingBase,
     idealSpending: idealSpendingBase + input.skippedIdealNominal,
     excessSpending: excessSpendingBase + input.skippedExcessNominal,
     intendedSpending:
```

This omits both skipped amounts, publishing $60,000 — the worksheet's second wrong reading. The intended fixture in the same file fails alongside.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualExpenseSummary.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualExpenseSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts (13 tests | 2 failed) 35ms
   ❯ spending-target-requested-annual — Annual target-layer requested spending (2)
     × carries the full target layer and each skipped amount once: 62500 4ms
   ❯ spending-intended-annual — Annual intended spending with no guardrail cut (2)
     × adds the target base and the two increments, each skipped goal once: 85250 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 11 passed (13)

  Transform  transforming modules took 2.18s · 43% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-target-requested-annual — Annual target-layer requested spending > carries the full target layer and each skipped amount once: 62500
AssertionError: targetSpending 60000 is not within {"abs":0.005} of the worksheet's 62500: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts:227:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-intended-annual — Annual intended spending with no guardrail cut > adds the target base and the two increments, each skipped goal once: 85250
AssertionError: targetSpending 70000 is not within {"abs":0.005} of the worksheet's 73000: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts:410:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualExpenseSummary.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualExpenseSummary.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
