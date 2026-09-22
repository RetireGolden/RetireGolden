# Mutation receipt: insight-irmaa-tier-edge-premium-cliff

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

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

Re-executed 2026-09-18 after the evidence fixture moved to the exact tolerance on the published whole-dollar figure (round three of the #720 review). The baseline is green (irmaaTierEdge.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s6/packages/engine

 ❯ src/insights/detectors/irmaaTierEdge.evidence.test.ts (1 test | 1 failed) 15ms
   ❯ insight-irmaa-tier-edge-premium-cliff — IRMAA tier-edge household Medicare premium cliff (1)
     × publishes a $3,600 household cliff from two enrollees × $1,800 14ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/insights/detectors/irmaaTierEdge.evidence.test.ts > insight-irmaa-tier-edge-premium-cliff — IRMAA tier-edge household Medicare premium cliff > publishes a $3,600 household cliff from two enrollees × $1,800
AssertionError: annualPremiumCliff 1800 is not within "exact" of the worksheet's 3600: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/insights/detectors/irmaaTierEdge.evidence.test.ts:104:9
    102|         withinTolerance(cliff, expected, example.tolerance),
    103|         `annualPremiumCliff ${cliff} is not within ${JSON.stringify(ex…
    104|       ).toBe(true)
       |         ^
    105|       expect(card!.impact.endingAfterTaxEstateDelta).toBe(expected)
    106|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/irmaaTierEdge.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/irmaaTierEdge.ts` exited 0, confirming no change to production code after the run.
