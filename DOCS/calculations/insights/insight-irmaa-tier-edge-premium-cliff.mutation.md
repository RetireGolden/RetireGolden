# Mutation receipt: insight-irmaa-tier-edge-premium-cliff

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/irmaaTierEdge.ts`

```diff
@@ -81,12 +81,11 @@ export const irmaaTierEdge: Detector = {
           )
           const annualPremiumCliff =
-            medicarePeople *
             Math.max(
               0,
               premiumAbove.partBAnnual +
                 premiumAbove.partDSurchargeAnnual -
                 premiumBelow.partBAnnual -
                 premiumBelow.partDSurchargeAnnual,
             )
```

This drops the enrollee count, so the household cliff is the per-person $1,800 — the worksheet's first wrong reading of forgetting the second enrollee.

## Command

```
npx vitest run src/insights/detectors/irmaaTierEdge.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/insights/detectors/irmaaTierEdge.evidence.test.ts > insight-irmaa-tier-edge-premium-cliff — IRMAA tier-edge household Medicare premium cliff > publishes a $3,600 household cliff from two enrollees × $1,800
AssertionError: annualPremiumCliff 1800 is not within {"abs":1e-9} of the worksheet's 3600: expected false to be true // Object.is equality
 ❯ src/insights/detectors/irmaaTierEdge.evidence.test.ts:104:9
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/irmaaTierEdge.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/irmaaTierEdge.ts` exited 0, confirming no change to production code after the run.
