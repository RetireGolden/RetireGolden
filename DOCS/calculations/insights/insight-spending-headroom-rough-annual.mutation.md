# Mutation receipt: insight-spending-headroom-rough-annual

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/spendingHeadroom.ts`

```diff
@@ -43,7 +43,7 @@ export const spendingHeadroom: Detector = {

     const endYear = ctx.projection.result.endYear
-    const yearsRemaining = Math.max(1, endYear - ctx.projection.startYear)
+    const yearsRemaining = Math.max(1, endYear - ctx.projection.startYear - 1)
     const bequestTarget = ctx.plan.expenses.bequestTargetDollars ?? 0
```

This shortens the denominator by one more year (8 instead of production's 9), so the $400,000 excess spreads to $50,000/year against the worksheet's $44,444 over 9 year boundaries.

## Command

```
npx vitest run src/insights/detectors/spendingHeadroom.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-18 after the worksheet re-derivation (the baseline is green: production publishes $44,444 for the 9 year boundaries the worksheet now states). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s6/packages/engine

 ❯ src/insights/detectors/spendingHeadroom.evidence.test.ts (1 test | 1 failed) 14ms
   ❯ insight-spending-headroom-rough-annual — Rough real annual spending headroom from excess terminal estate (1)
     × deflates $1,200,000 by 3/4 to $900,000 and spreads the $400,000 excess over the 9 year boundaries of 2026-2035 13ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/insights/detectors/spendingHeadroom.evidence.test.ts > insight-spending-headroom-rough-annual — Rough real annual spending headroom from excess terminal estate > deflates $1,200,000 by 3/4 to $900,000 and spreads the $400,000 excess over the 9 year boundaries of 2026-2035
AssertionError: roughAnnualHeadroom 50000 is not within {"abs":1e-9} of the worksheet's 44444: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/insights/detectors/spendingHeadroom.evidence.test.ts:69:9
     67|         withinTolerance(headroom, expectedHeadroom, example.tolerance),
     68|         `roughAnnualHeadroom ${headroom} is not within ${JSON.stringif…
     69|       ).toBe(true)
       |         ^
     70|     })
     71|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed (1)
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/spendingHeadroom.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/spendingHeadroom.ts` exited 0, confirming no change to production code after the run.
