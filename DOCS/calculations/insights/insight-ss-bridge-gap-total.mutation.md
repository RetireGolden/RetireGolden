# Mutation receipt: insight-ss-bridge-gap-total

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/ssBridgeGap.ts`

```diff
diff --git a/packages/engine/src/insights/detectors/ssBridgeGap.ts b/packages/engine/src/insights/detectors/ssBridgeGap.ts
index ed4bbf80..2ff1fa55 100644
--- a/packages/engine/src/insights/detectors/ssBridgeGap.ts
+++ b/packages/engine/src/insights/detectors/ssBridgeGap.ts
@@ -44,7 +44,7 @@ export const ssBridgeGap: Detector = {
       })
       if (!sized) continue
       const covered = plan.incomeFloor?.ladders.some((l) => l.startYear <= sized.startYear && l.endYear >= sized.endYear)
-      if (covered) continue
+      void covered
       totalCost += sized.ladderCost
       firstYear = Math.min(firstYear, sized.startYear)
       lastYear = Math.max(lastYear, sized.endYear)
```

Stop skipping claimants whose gap a plan ladder already covers (the worksheet's wrong reading that adds the covered claimant, $290,000). Under the corrected household gate the inflated total raises the required balance above the $120,000 on hand, so the mutant suppresses the card altogether and the assertion fails on the missing card rather than on a wrong sum; either way the published totals never appear.

## Command

```
npx vitest run src/insights/detectors/ssBridgeGap.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-18 after the #720 review and the worksheet revision; the baseline is green (ssBridgeGap.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s6/packages/engine

 ❯ src/insights/detectors/ssBridgeGap.evidence.test.ts (1 test | 1 failed) 5ms
   ❯ insight-ss-bridge-gap-total — Household Social Security bridge: summed ladder cost and annual real income (1)
     × sums A and C only: $200,000 cost and $30,000/year when household liquid $120,000 clears the 50% gate 4ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/insights/detectors/ssBridgeGap.evidence.test.ts > insight-ss-bridge-gap-total — Household Social Security bridge: summed ladder cost and annual real income > sums A and C only: $200,000 cost and $30,000/year when household liquid $120,000 clears the 50% gate
AssertionError: expected null not to be null
 ❯ src/insights/detectors/ssBridgeGap.evidence.test.ts:106:24
    104|       stubSizedBridges()
    105|       const card = ssBridgeGap.screen(context(example.inputs.liquidBal…
    106|       expect(card).not.toBeNull()
       |                        ^
    107|       const costRow = card!.evidence.find((entry) => entry.label === '…
    108|       const annualRow = card!.evidence.find((entry) =>

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/ssBridgeGap.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/ssBridgeGap.ts` exited 0, confirming no change to production code after the run; the named suite passes again on the restored file.
