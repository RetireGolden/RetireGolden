# Mutation receipt: portfolio-need-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-26 against RetireGolden base `89bdd105` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualYearResultAssembly.ts`

```diff
@@ -307,8 +307,8 @@ export function annualYearResultAssembly(
     // no existing key moves position — key order is observable output here.
     netPortfolioNeed: Math.max(
       0,
-      ledger.expenses.total + tax.tax + tax.penalties - ledger.incomes.total,
+      ledger.expenses.total + tax.tax - ledger.incomes.total,
     ),
     // Published after netPortfolioNeed for the same reason: no existing key moves.
     unassignedCash: snapshot.unassignedCash,
   }
```

This omits penalties from the need, publishing $16,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualYearResultAssembly.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-26 for B2-P1 slice 1, which publishes YearResult.unassignedCash right after netPortfolioNeed, so the diff's trailing context now shows that line and every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualYearResultAssembly.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine4/packages/engine

 ❯ src/projection/internal/annualYearResultAssembly.evidence.test.ts (7 tests | 1 failed) 32ms
   ❯ portfolio-need-annual — Annual net portfolio need (3)
     × publishes 17000 of uncovered outflow 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)

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
