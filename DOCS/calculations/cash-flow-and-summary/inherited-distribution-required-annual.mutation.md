# Mutation receipt: inherited-distribution-required-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (inheritedIra.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

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

The original bytes of `packages/engine/src/strategies/inheritedIra.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/strategies/inheritedIra.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
