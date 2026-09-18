# Mutation receipt: insight-spending-headroom-rough-annual

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/spendingHeadroom.ts`

```diff
@@ -43,7 +43,7 @@ export const spendingHeadroom: Detector = {

     const endYear = ctx.projection.result.endYear
-    const yearsRemaining = Math.max(1, endYear - ctx.projection.startYear)
+    const yearsRemaining = Math.max(1, endYear - ctx.projection.startYear - 1)
     const bequestTarget = ctx.plan.expenses.bequestTargetDollars ?? 0
```

This shortens the denominator by one more year (8 instead of production's 9), so the $400,000 excess spreads to $50,000/year. The unmutated production already uses `endYear − startYear` = 9 for 2026–2035 and publishes $44,444 against the worksheet's inclusive-row $40,000; the mutation moves that miss further.

## Command

```
npx vitest run src/insights/detectors/spendingHeadroom.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/insights/detectors/spendingHeadroom.evidence.test.ts > insight-spending-headroom-rough-annual — Rough real annual spending headroom from excess terminal estate > deflates $1,200,000 by 3/4 to $900,000 and spreads the $400,000 excess over 10 years
AssertionError: roughAnnualHeadroom 50000 is not within {"abs":1e-9} of the worksheet's 40000: expected false to be true // Object.is equality
 ❯ src/insights/detectors/spendingHeadroom.evidence.test.ts:68:9
```

Unmutated production already fails the same assertion with `roughAnnualHeadroom 44444` (nine year-to-year intervals). The mutation is still observed: the published number moves from 44444 to 50000.

## Revert

`git checkout -- packages/engine/src/insights/detectors/spendingHeadroom.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/spendingHeadroom.ts` exited 0, confirming no change to production code after the run.
