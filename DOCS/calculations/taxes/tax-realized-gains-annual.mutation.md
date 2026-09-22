# Mutation receipt: tax-realized-gains-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualYearResultAssembly.ts`

```diff
@@ -267,8 +267,7 @@
     withdrawals: funding.withdrawals,
     realizedGains:
       funding.realizedGains.withdrawal +
-      funding.realizedGains.rebalance +
-      funding.realizedGains.retirementAction,
+      funding.realizedGains.rebalance,
     taxableYield: ledger.incomes.taxableYield,
     taxExemptInterest: funding.taxExemptInterest,
     capitalLossUsedAgainstGains: funding.capitalLossUsedAgainstGains,
```

This drops the signed retirement-action loss, publishing $3,250 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualYearResultAssembly.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualYearResultAssembly.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualYearResultAssembly.evidence.test.ts (7 tests | 2 failed) 31ms
   ❯ tax-realized-gains-annual — Annual realized gains, signed and composed (2)
     × folds 2500, 750 and -200 into a signed 3050 3ms
     × lets one source loss offset another source gain rather than flooring it 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)

  Transform  transforming modules took 2.38s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualYearResultAssembly.evidence.test.ts > tax-realized-gains-annual — Annual realized gains, signed and composed > folds 2500, 750 and -200 into a signed 3050
AssertionError: realizedGains 3250 is not within {"abs":0.005} of the worksheet's 3050: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualYearResultAssembly.evidence.test.ts:388:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualYearResultAssembly.evidence.test.ts > tax-realized-gains-annual — Annual realized gains, signed and composed > lets one source loss offset another source gain rather than flooring it
AssertionError: expected 2500 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 2500

 ❯ src/projection/internal/annualYearResultAssembly.evidence.test.ts:419:33
    417|         },
    418|       })
    419|       expect(row.realizedGains).toBe(0)
       |                                 ^
    420|     })
    421|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualYearResultAssembly.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualYearResultAssembly.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
