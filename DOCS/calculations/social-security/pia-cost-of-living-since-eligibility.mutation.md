# Mutation receipt: pia-cost-of-living-since-eligibility

Executed 2026-09-27 against RetireGolden base `2d5fd40c` (branch `claude/social-security-law-2`; no pull request is open yet) for the new record under decision D-SS-LAW-2, and re-executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/piaFromEarnings.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/piaFromEarnings.ts b/packages/engine/src/socialSecurity/piaFromEarnings.ts
index d90a5df9..f9aacc5d 100644
--- a/packages/engine/src/socialSecurity/piaFromEarnings.ts
+++ b/packages/engine/src/socialSecurity/piaFromEarnings.ts
@@ -318,7 +318,7 @@ export function piaWithCostOfLivingIncreases(
 ): PiaWithCostOfLivingIncreases {
   let pia = piaMonthly
   const standInYears: number[] = []
-  for (let year = eligibilityYear; year <= throughYear; year++) {
+  for (let year = eligibilityYear; year < eligibilityYear; year++) {
     const published = COLA_PCT_BY_YEAR[year]
     if (published === undefined) standInYears.push(year)
     pia = floorToDime(pia * (1 + (published ?? standInPct) / 100))
```

This applies no increase at all, leaving the eligibility-year PIA in place as the engine did until 2026-09-27 (the worksheet's first wrong reading): case A publishes $34,156.80 for 2027.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/piaFromEarnings.costOfLiving.evidence.test.ts
```

## Captured failing output

Re-executed for B2-P1 slice 4 because lines moved above its hunk (the survival curve, the PIA resolver and the zero-year gain, or simulatePlan's COLA helpers) or its test file gained cases; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (piaFromEarnings.costOfLiving.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/socialSecurity/piaFromEarnings.costOfLiving.evidence.test.ts (4 tests | 3 failed) 44ms
   ❯ pia-cost-of-living-since-eligibility — An earnings-history PIA raised by the cost-of-living increases since eligibility (4)
     × cases A and B: the published chain, floored to the dime each year (3,364.40 and 3,379.20) 3ms
     × case A: the ledger pays the start-year PIA (40,372.80 in 2027, not 34,156.80) 38ms
     × case C: unannounced years use the plan's COLA assumption, with a warning (42,002.40 in 2028) 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/piaFromEarnings.costOfLiving.evidence.test.ts > pia-cost-of-living-since-eligibility — An earnings-history PIA raised by the cost-of-living increases since eligibility > cases A and B: the published chain, floored to the dime each year (3,364.40 and 3,379.20)
AssertionError: caseA PIA 2846.4 is not within 0.005 of the worksheet's 3364.4: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/piaFromEarnings.costOfLiving.evidence.test.ts:45:5
     43|     withinTolerance(actual, expected, { abs: 0.005 }),
     44|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     45|   ).toBe(true)
       |     ^
     46| }
     47|
 ❯ src/socialSecurity/piaFromEarnings.costOfLiving.evidence.test.ts:84:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/socialSecurity/piaFromEarnings.costOfLiving.evidence.test.ts > pia-cost-of-living-since-eligibility — An earnings-history PIA raised by the cost-of-living increases since eligibility > case A: the ledger pays the start-year PIA (40,372.80 in 2027, not 34,156.80)
AssertionError: caseA 2027 34156.8 is not within 0.005 of the worksheet's 40372.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/piaFromEarnings.costOfLiving.evidence.test.ts:45:5
     43|     withinTolerance(actual, expected, { abs: 0.005 }),
     44|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     45|   ).toBe(true)
       |     ^
     46| }
     47|
 ❯ src/socialSecurity/piaFromEarnings.costOfLiving.evidence.test.ts:95:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/socialSecurity/piaFromEarnings.costOfLiving.evidence.test.ts > pia-cost-of-living-since-eligibility — An earnings-history PIA raised by the cost-of-living increases since eligibility > case C: unannounced years use the plan's COLA assumption, with a warning (42,002.40 in 2028)
AssertionError: caseC PIA 2846.4 is not within 0.005 of the worksheet's 3500.2: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/piaFromEarnings.costOfLiving.evidence.test.ts:45:5
     43|     withinTolerance(actual, expected, { abs: 0.005 }),
     44|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     45|   ).toBe(true)
       |     ^
     46| }
     47|
 ❯ src/socialSecurity/piaFromEarnings.costOfLiving.evidence.test.ts:102:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/piaFromEarnings.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/piaFromEarnings.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
