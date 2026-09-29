# Mutation receipt: medicare-base-part-b-premium

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `aea4dac1` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/medicare.ts`

```diff
@@ -51,7 +51,7 @@ export function medicareAnnualPremiumPerPerson(
   const partBMonthly = base * (applicablePct / 25) * premiumScale
 
   return {
-    partBAnnual: partBMonthly * 12,
+    partBAnnual: partBMonthly,
     partDSurchargeAnnual: partDSurchargeMonthly * 12 * premiumScale,
     irmaaSurchargeAnnual:
       Math.max(0, partBMonthly - base * premiumScale) * 12 +
```

This treats the $202.90 monthly premium as the annual figure — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/medicare.evidence.test.ts
```

## Captured failing output

Decision D-2027-ROLLOVER moved the lines these receipts quote (the per-publisher parameter split and the pre-start warnings in projection/simulate.ts and its annual phases, imports added to evidence files) and restated six of the records; the mutations are unchanged. The baseline is green (medicare.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine21/packages/engine

 ❯ src/tax/medicare.evidence.test.ts (8 tests | 5 failed) 8ms
   ❯ medicare-base-part-b-premium — Medicare base Part B premium (2)
     × annualizes the 202.90 standard monthly premium into 2,434.80 at tier 0 5ms
     × charges twelve months, not one 0ms
   ❯ medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary (3)
     × keeps 109,000 itself in tier 0: the test is strictly greater than 0ms
     × prices 109,001 at 35/25 of standard plus the 14.50 Part D surcharge 0ms
     × reads the applicable percentage as a share of program cost, not a surcharge 0ms

 Test Files  1 failed (1)
      Tests  5 failed | 3 passed (8)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-base-part-b-premium — Medicare base Part B premium > annualizes the 202.90 standard monthly premium into 2,434.80 at tier 0
AssertionError: partBAnnual 202.9 is not within {"abs":0.005} of the worksheet's 2434.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/medicare.evidence.test.ts:19:5
     17|     withinTolerance(actual, expected, tolerance),
     18|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     19|   ).toBe(true)
       |     ^
     20| }
     21|
 ❯ src/tax/medicare.evidence.test.ts:41:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-base-part-b-premium — Medicare base Part B premium > charges twelve months, not one
AssertionError: partBAnnual 202.9 is not within {"abs":0.005} of the worksheet's 2434.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/medicare.evidence.test.ts:19:5
     17|     withinTolerance(actual, expected, tolerance),
     18|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     19|   ).toBe(true)
       |     ^
     20| }
     21|
 ❯ src/tax/medicare.evidence.test.ts:49:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary > keeps 109,000 itself in tier 0: the test is strictly greater than
AssertionError: partBAnnual 202.9 is not within {"abs":0.005} of the worksheet's 2434.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/medicare.evidence.test.ts:19:5
     17|     withinTolerance(actual, expected, tolerance),
     18|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     19|   ).toBe(true)
       |     ^
     20| }
     21|
 ❯ src/tax/medicare.evidence.test.ts:95:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary > prices 109,001 at 35/25 of standard plus the 14.50 Part D surcharge
AssertionError: partBAnnual 284.06 is not within {"abs":0.005} of the worksheet's 3408.72: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/medicare.evidence.test.ts:19:5
     17|     withinTolerance(actual, expected, tolerance),
     18|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     19|   ).toBe(true)
       |     ^
     20| }
     21|
 ❯ src/tax/medicare.evidence.test.ts:107:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary > reads the applicable percentage as a share of program cost, not a surcharge
AssertionError: expected 284.06 to be greater than 3286.9800000000005
 ❯ src/tax/medicare.evidence.test.ts:116:34
    114|       const result = medicareAnnualPremiumPerPerson(pack, inputs.lookb…
    115|       const surchargeReadingAnnual = pack.medicare.partBStandardMonthl…
    116|       expect(result.partBAnnual).toBeGreaterThan(surchargeReadingAnnua…
       |                                  ^
    117|     })
    118|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/medicare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/medicare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
