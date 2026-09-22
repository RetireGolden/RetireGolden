# Mutation receipt: medicare-base-part-b-premium

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/medicare.ts`

```diff
@@ -58,7 +58,7 @@ export function medicareAnnualPremiumPerPerson(
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

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (medicare.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/tax/medicare.evidence.test.ts (7 tests | 5 failed) 7ms
   ❯ medicare-base-part-b-premium — Medicare base Part B premium (2)
     × annualizes the 202.90 standard monthly premium into 2,434.80 at tier 0 4ms
     × charges twelve months, not one 0ms
   ❯ medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary (3)
     × keeps 109,000 itself in tier 0: the test is strictly greater than 0ms
     × prices 109,001 at 35/25 of standard plus the 14.50 Part D surcharge 0ms
     × reads the applicable percentage as a share of program cost, not a surcharge 0ms

 Test Files  1 failed (1)
      Tests  5 failed | 2 passed (7)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-base-part-b-premium — Medicare base Part B premium > annualizes the 202.90 standard monthly premium into 2,434.80 at tier 0
AssertionError: partBAnnual 202.9 is not within {"abs":0.005} of the worksheet's 2434.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/medicare.evidence.test.ts:18:5
     16|     withinTolerance(actual, expected, tolerance),
     17|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     18|   ).toBe(true)
       |     ^
     19| }
     20|
 ❯ src/tax/medicare.evidence.test.ts:40:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-base-part-b-premium — Medicare base Part B premium > charges twelve months, not one
AssertionError: partBAnnual 202.9 is not within {"abs":0.005} of the worksheet's 2434.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/medicare.evidence.test.ts:18:5
     16|     withinTolerance(actual, expected, tolerance),
     17|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     18|   ).toBe(true)
       |     ^
     19| }
     20|
 ❯ src/tax/medicare.evidence.test.ts:48:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary > keeps 109,000 itself in tier 0: the test is strictly greater than
AssertionError: partBAnnual 202.9 is not within {"abs":0.005} of the worksheet's 2434.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/medicare.evidence.test.ts:18:5
     16|     withinTolerance(actual, expected, tolerance),
     17|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     18|   ).toBe(true)
       |     ^
     19| }
     20|
 ❯ src/tax/medicare.evidence.test.ts:94:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary > prices 109,001 at 35/25 of standard plus the 14.50 Part D surcharge
AssertionError: partBAnnual 284.06 is not within {"abs":0.005} of the worksheet's 3408.72: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/medicare.evidence.test.ts:18:5
     16|     withinTolerance(actual, expected, tolerance),
     17|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     18|   ).toBe(true)
       |     ^
     19| }
     20|
 ❯ src/tax/medicare.evidence.test.ts:106:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary > reads the applicable percentage as a share of program cost, not a surcharge
AssertionError: expected 284.06 to be greater than 3286.9800000000005
 ❯ src/tax/medicare.evidence.test.ts:115:34
    113|       const result = medicareAnnualPremiumPerPerson(pack, inputs.lookb…
    114|       const surchargeReadingAnnual = pack.medicare.partBStandardMonthl…
    115|       expect(result.partBAnnual).toBeGreaterThan(surchargeReadingAnnua…
       |                                  ^
    116|     })
    117|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/medicare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/medicare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
