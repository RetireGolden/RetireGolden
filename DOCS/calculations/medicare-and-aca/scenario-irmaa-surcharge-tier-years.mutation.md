# Mutation receipt: scenario-irmaa-surcharge-tier-years

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/scenarios/comparison.ts`

```diff
@@ -702,8 +702,8 @@ export function compareScenarioPlans(
         sum(proposalResult.years, (y) => y.medicarePremiums),
       ),
       surchargeTierYears: scalar(
-        baselineResult.years.filter((y) => y.irmaaTier > 0).length,
-        proposalResult.years.filter((y) => y.irmaaTier > 0).length,
+        baselineResult.years.filter((y) => y.irmaaTier >= 0).length,
+        proposalResult.years.filter((y) => y.irmaaTier >= 0).length,
       ),
```

This counts tier 0 as a surcharge year, so both sides have 5 years — the worksheet's second wrong reading.

## Command

```
npx vitest run src/scenarios/comparison.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/scenarios/comparison.evidence.test.ts > scenario-irmaa-surcharge-tier-years — Scenario comparison: years in an IRMAA surcharge tier > counts 3 baseline and 2 proposal surcharge-tier years (delta −1)
AssertionError: expected 5 to be 3 // Object.is equality
 ❯ src/scenarios/comparison.evidence.test.ts:161:60
```

## Revert

`git checkout -- packages/engine/src/scenarios/comparison.ts`, then `git diff --quiet -- packages/engine/src/scenarios/comparison.ts` exited 0, confirming no change to production code after the run.
