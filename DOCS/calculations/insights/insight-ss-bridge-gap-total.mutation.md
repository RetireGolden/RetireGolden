# Mutation receipt: insight-ss-bridge-gap-total

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/ssBridgeGap.ts`

```diff
@@ -45,8 +45,8 @@ export const ssBridgeGap: Detector = {
       if (!sized) continue
       const covered = plan.incomeFloor?.ladders.some((l) => l.startYear <= sized.startYear && l.endYear >= sized.endYear)
-      if (covered) continue
+      void covered
       totalCost += sized.ladderCost
```

This includes the already-covered claimant, so household cost becomes $290,000 — the worksheet's first wrong reading.

## Command

```
npx vitest run src/insights/detectors/ssBridgeGap.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/insights/detectors/ssBridgeGap.evidence.test.ts > insight-ss-bridge-gap-total — Household Social Security bridge: summed ladder cost and annual real income > sums A and C only: $200,000 cost and $30,000/year, excluding the already-covered claimant
AssertionError: totalCost 290000 is not within {"abs":1e-9} of the worksheet's 200000: expected false to be true // Object.is equality
 ❯ src/insights/detectors/ssBridgeGap.evidence.test.ts:110:9
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/ssBridgeGap.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/ssBridgeGap.ts` exited 0, confirming no change to production code after the run.
