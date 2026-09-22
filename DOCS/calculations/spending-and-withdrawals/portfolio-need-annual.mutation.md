# Mutation receipt: portfolio-need-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualYearResultAssembly.ts`

```diff
@@ -307,7 +307,7 @@ export function annualYearResultAssembly(
     // no existing key moves position — key order is observable output here.
     netPortfolioNeed: Math.max(
       0,
-      ledger.expenses.total + tax.tax + tax.penalties - ledger.incomes.total,
+      ledger.expenses.total + tax.tax - ledger.incomes.total,
     ),
   }
 }
```

This omits penalties from the need, publishing $16,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualYearResultAssembly.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualYearResultAssembly.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualYearResultAssembly.evidence.test.ts (5 tests | 1 failed) 31ms
   ❯ portfolio-need-annual — Annual net portfolio need (3)
     × publishes 17000 of uncovered outflow 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)

  Transform  transforming modules took 2.14s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualYearResultAssembly.evidence.test.ts > portfolio-need-annual — Annual net portfolio need > publishes 17000 of uncovered outflow
AssertionError: netPortfolioNeed 16000 is not within {"abs":0.005} of the worksheet's 17000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualYearResultAssembly.evidence.test.ts:145:5
    143|     withinTolerance(actual, target, tolerance),
    144|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
    145|   ).toBe(true)
       |     ^
    146| }
    147|
 ❯ src/projection/internal/annualYearResultAssembly.evidence.test.ts:305:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualYearResultAssembly.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualYearResultAssembly.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
