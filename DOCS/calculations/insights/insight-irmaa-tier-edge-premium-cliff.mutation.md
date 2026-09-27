# Mutation receipt: insight-irmaa-tier-edge-premium-cliff

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/irmaaTierEdge.ts`

```diff
@@ -87,10 +87,9 @@ export const irmaaTierEdge: Detector = {
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

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from and its hunk header's line counts did not match the hunk; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (irmaaTierEdge.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/insights/detectors/irmaaTierEdge.evidence.test.ts (1 test | 1 failed) 14ms
   ❯ insight-irmaa-tier-edge-premium-cliff — IRMAA tier-edge household Medicare premium cliff (1)
     × publishes a $3,600 household cliff from two enrollees × $1,800 13ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


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

The original bytes of `packages/engine/src/insights/detectors/irmaaTierEdge.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/insights/detectors/irmaaTierEdge.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
