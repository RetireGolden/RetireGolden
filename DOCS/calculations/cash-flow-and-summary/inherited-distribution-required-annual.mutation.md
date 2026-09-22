# Mutation receipt: inherited-distribution-required-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/inheritedIra.ts`

```diff
@@ -93,8 +93,8 @@
   // `beneficiaryAge` is the age attained in `year`; walk it back to the age
   // attained in the first distribution year, which is the only age the table is
   // ever read at for this account.
-  const ageInFirstYear = input.beneficiaryAge - elapsed
-  return singleLifeExpectancyYears(pack, ageInFirstYear) - elapsed
+  const ageInFirstYear = input.beneficiaryAge
+  return singleLifeExpectancyYears(pack, ageInFirstYear)
 }
 
 export interface InheritedForcedInput {
```

This re-reads the Single Life Table at the beneficiary's current age instead of decrementing the fixed entry, so 2028 uses the age-76 divisor 14.1 rather than 13.8 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/inheritedIra.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-18 against base `2088f4bb`, after the worksheet was re-derived onto the greater-divisor comparison and its fixture rebuilt: the impossible 10.8 owner divisor and the "records that production selects the greater divisor" test are gone, replaced by the two post-RBD rows in the first year after the death year (beneficiary 14.8 against owner 6.6 publishing 10,000, and beneficiary 5.7 against owner 6.6 publishing 22,424.242424). The same mutation still fails the 2028 fixed-minus-one continuation; the two new post-RBD rows read the table in the first distribution year, where the fixed arm has not yet been decremented, so this mutation does not move them. The baseline is green: inheritedIra.evidence.test.ts passes on unmodified production. Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s11/packages/engine

 ❯ src/strategies/inheritedIra.evidence.test.ts (10 tests | 1 failed) 7ms
   ❯ inherited-distribution-required-annual — Annual inherited-account required amount (6)
     × continues the fixed divisor at 13.8 in 2028 rather than re-reading the table at 76 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/strategies/inheritedIra.evidence.test.ts > inherited-distribution-required-annual — Annual inherited-account required amount > continues the fixed divisor at 13.8 in 2028 rather than re-reading the table at 76
AssertionError: expected 14.1 to be 13.8 // Object.is equality

- Expected
+ Received

- 13.8
+ 14.1

 ❯ src/strategies/inheritedIra.evidence.test.ts:237:32
    235|       expect(pack.rmd.singleLifeTable[76]).toBe(14.1)
    236|       const evidence = requirement(annualArm, inputs.secondYear!, bala…
    237|       expect(evidence.divisor).toBe(inputs.secondYearBeneficiaryDiviso…
       |                                ^
    238|       expectWithin(
    239|         evidence.requiredAmount, expected.secondYearRequired!, example…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/strategies/inheritedIra.ts`, then `git diff --quiet -- packages/engine/src/strategies/inheritedIra.ts` exited 0, confirming no change to production code after the run.
