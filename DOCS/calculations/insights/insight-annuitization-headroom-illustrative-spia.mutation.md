# Mutation receipt: insight-annuitization-headroom-illustrative-spia

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/annuitizationHeadroom.ts`

```diff
@@ -16,6 +16,6 @@
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

Re-executed for D-RECEIPT-DRIFT because its hunk header's line counts did not match the hunk; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (annuitizationHeadroom.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/insights/detectors/annuitizationHeadroom.evidence.test.ts (1 test | 1 failed) 15ms
   ❯ insight-annuitization-headroom-illustrative-spia — Illustrative SPIA premium and monthly payout from unused longevity headroom (1)
     × illustrates a $200,000 premium and $1,100/month from a quarter of $800,000 at 6.6% 14ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


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

The original bytes of `packages/engine/src/insights/detectors/annuitizationHeadroom.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/insights/detectors/annuitizationHeadroom.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
