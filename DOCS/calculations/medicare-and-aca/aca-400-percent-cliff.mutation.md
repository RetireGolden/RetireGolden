# Mutation receipt: aca-400-percent-cliff

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/aca.ts`

```diff
@@ -186,7 +186,7 @@ export function acaEconomicPremiumByMonth(
   )
   const fpl = acaFederalPovertyLine(pack, householdSize, region, fplScale)
   const fplPct = fpl > 0 ? (magi / fpl) * 100 : Infinity
-  const overCliff = fplPct > pack.aca.maxFplPctForCredit
+  const overCliff = fplPct >= pack.aca.maxFplPctForCredit
   const belowEligibilityFloor = fplPct < pack.aca.minFplPctForCredit
 
   if (overCliff || belowEligibilityFloor || grossEnrollmentPremium <= 0 || applicableSlcspPremium <= 0) {
```

This makes the 400% ceiling exclusive, so a household at exactly 400% of the poverty line is over the cliff and gets no credit — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/aca.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (aca.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/tax/aca.evidence.test.ts (13 tests | 1 failed) 8ms
   ❯ aca-400-percent-cliff — ACA 400% FPL cliff (3)
     × allows the credit at exactly 400% of the poverty line 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-400-percent-cliff — ACA 400% FPL cliff > allows the credit at exactly 400% of the poverty line
AssertionError: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/tax/aca.evidence.test.ts:74:33
     72|       expect(acaFederalPovertyLine(pack, inputs.householdSize!)).toBe(…
     73|       const atCliff = resultFor(inputs.magiAtCliff!)
     74|       expect(atCliff.overCliff).toBe(false)
       |                                 ^
     75|       expectWithin(atCliff.fplPct, expected.fplPctAtCliff!, { abs: inp…
     76|       expectWithin(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/aca.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/aca.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
