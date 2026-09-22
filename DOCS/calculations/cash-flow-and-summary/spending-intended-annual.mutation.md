# Mutation receipt: spending-intended-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualExpenseSummary.ts`

```diff
@@ -94,11 +94,7 @@ export function annualExpenseSummary(
     intendedSpending:
       targetSpendingBase +
       idealSpendingBase +
-      excessSpendingBase +
-      input.skippedTargetNominal +
-      input.skippedRequiredNominal +
-      input.skippedIdealNominal +
-      input.skippedExcessNominal,
+      excessSpendingBase,
     guardrailFactor: input.discretionaryMultiplier,
     total:
       baseSpending +
```

This drops all four skipped-goal amounts, publishing $81,500 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualExpenseSummary.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualExpenseSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts (13 tests | 1 failed) 33ms
   ❯ spending-intended-annual — Annual intended spending with no guardrail cut (2)
     × adds the target base and the two increments, each skipped goal once: 85250 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)

  Transform  transforming modules took 2.19s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualExpenseSummary.evidence.test.ts > spending-intended-annual — Annual intended spending with no guardrail cut > adds the target base and the two increments, each skipped goal once: 85250
AssertionError: intendedSpending 81500 is not within {"abs":0.005} of the worksheet's 85250: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualExpenseSummary.evidence.test.ts:414:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualExpenseSummary.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualExpenseSummary.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
