# Mutation receipt: insight-annuitization-headroom-illustrative-spia

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/annuitizationHeadroom.ts`

```diff
@@ -16,7 +16,7 @@
 /** Below this, the largest liquid account cannot fund a meaningful SPIA. */
 const MIN_LIQUID_BALANCE_DOLLARS = 100_000
 /** Illustrative premium: this share of the funding account... */
-const ILLUSTRATIVE_PREMIUM_FRACTION_OF_LIQUID = 0.25
+const ILLUSTRATIVE_PREMIUM_FRACTION_OF_LIQUID = 1
 /** ...capped here, so a very large account does not illustrate an outsized SPIA. */
 const ILLUSTRATIVE_PREMIUM_CAP_DOLLARS = 250_000
```

This replaces the quarter-account illustration with the whole account, so `min($800,000, $250,000) = $250,000` — the worksheet's first wrong reading of always using the cap.

## Command

```
npx vitest run src/insights/detectors/annuitizationHeadroom.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-18 after the evidence fixture moved to the exact tolerance on the published whole-dollar figure (round three of the #720 review). The baseline is green (annuitizationHeadroom.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s6/packages/engine

 ❯ src/insights/detectors/annuitizationHeadroom.evidence.test.ts (1 test | 1 failed) 14ms
   ❯ insight-annuitization-headroom-illustrative-spia — Illustrative SPIA premium and monthly payout from unused longevity headroom (1)
     × illustrates a $200,000 premium and $1,100/month from a quarter of $800,000 at 6.6% 14ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/insights/detectors/annuitizationHeadroom.evidence.test.ts > insight-annuitization-headroom-illustrative-spia — Illustrative SPIA premium and monthly payout from unused longevity headroom > illustrates a $200,000 premium and $1,100/month from a quarter of $800,000 at 6.6%
AssertionError: premium 250000 is not within "exact" of the worksheet's 200000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/insights/detectors/annuitizationHeadroom.evidence.test.ts:62:9
     60|         withinTolerance(premium, expectedPremium, example.tolerance),
     61|         `premium ${premium} is not within ${JSON.stringify(example.tol…
     62|       ).toBe(true)
       |         ^
     63|
     64|       const monthlyRow = card!.evidence.find((entry) => entry.label.st…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/annuitizationHeadroom.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/annuitizationHeadroom.ts` exited 0, confirming no change to production code after the run.
