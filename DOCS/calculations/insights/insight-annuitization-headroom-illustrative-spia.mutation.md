# Mutation receipt: insight-annuitization-headroom-illustrative-spia

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1c7341f5` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/annuitizationHeadroom.ts`

```diff
@@ -17,6 +17,6 @@
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

Re-executed because decision D-PEOPLE-ORDER's canonical-person changes moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (annuitizationHeadroom.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/insights/detectors/annuitizationHeadroom.evidence.test.ts (2 tests | 2 failed) 17ms
   ❯ insight-annuitization-headroom-illustrative-spia — Illustrative SPIA premium and monthly payout from unused longevity headroom (2)
     × illustrates a $200,000 premium and $1,100/month from a quarter of $800,000 at 6.6% 15ms
     × for a couple, illustrates on the older person, whoever is listed first, and names them 1ms

 Test Files  1 failed (1)
      Tests  2 failed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/insights/detectors/annuitizationHeadroom.evidence.test.ts > insight-annuitization-headroom-illustrative-spia — Illustrative SPIA premium and monthly payout from unused longevity headroom > for a couple, illustrates on the older person, whoever is listed first, and names them
AssertionError: expected 250000 to be 200000 // Object.is equality

- Expected
+ Received

- 200000
+ 250000

 ❯ src/insights/detectors/annuitizationHeadroom.evidence.test.ts:91:64
     89|         const spia = patch.accounts.find((account) => account.type ===…
     90|         expect([spia.ownerPersonId, spia.startAge]).toEqual(['p2', 68])
     91|         expect(evidenceUsd(card, 'Illustrative SPIA premium')).toBe(ex…
       |                                                                ^
     92|       }
     93|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/insights/detectors/annuitizationHeadroom.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/insights/detectors/annuitizationHeadroom.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
