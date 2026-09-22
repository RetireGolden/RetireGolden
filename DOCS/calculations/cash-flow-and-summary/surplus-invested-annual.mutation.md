# Mutation receipt: surplus-invested-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts`

```diff
@@ -1187,7 +1187,7 @@
     // The caller retains observable live line/map mutation, coordinated-then-
     // backstop accumulation, capture gating, and downstream residual use.
     // Those effects make this application loop orchestration, not HECM policy.
-    const surplus = Math.max(0, cashInflows - expenses.total - contributions - tax - penalties)
+    const surplus = Math.max(0, cashInflows - expenses.total - tax - penalties)
     const iraCharacterFinal = needBasedOwnedIraCharacter(
       withdrawalPlan.byAccountId,
     )
```

This omits contributions from the residual, publishing $40,000 — the worksheet's first wrong reading. The same mutation also publishes $5,000 where the floored case must publish $0.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (simulate.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/simulate.evidence.test.ts (9 tests | 2 failed) 55ms
   ❯ surplus-invested-annual — Annual surplus invested, floored at zero (2)
     × publishes 30000 of residual cash and credits it to the lowest-id cash account 8ms
     × floors a 5000 negative residual at zero instead of publishing it 2ms

 Test Files  1 failed (1)
      Tests  2 failed | 7 passed (9)

  Transform  transforming modules took 2.44s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/simulate.evidence.test.ts > surplus-invested-annual — Annual surplus invested, floored at zero > publishes 30000 of residual cash and credits it to the lowest-id cash account
AssertionError: surplusInvested 40000 is not within {"abs":0.005} of the worksheet's 30000: expected false to be true // Object.is equality

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
 ❯ src/projection/simulate.evidence.test.ts:557:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/simulate.evidence.test.ts > surplus-invested-annual — Annual surplus invested, floored at zero > floors a 5000 negative residual at zero instead of publishing it
AssertionError: expected 5000 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 5000

 ❯ src/projection/simulate.evidence.test.ts:603:35
    601|         'residual before the floor',
    602|       )
    603|       expect(row.surplusInvested).toBe(expected.negativeResidualSurplu…
       |                                   ^
    604|     })
    605|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
