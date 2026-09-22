# Mutation receipt: tax-penalties-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualFundingCandidateEvaluation.ts`

```diff
@@ -454,7 +454,6 @@
       aca.healthcareExcludingEnrollment + aca.grossEnrollmentPremium
   }
   const penalties =
-    withdrawalEffectsProbe.penaltyExcludingRmdShortfallExcise +
     input.rmdShortfallExciseTax
 
   return {
```

This drops the early-withdrawal component from the composed penalties, so the year's need falls and the solved traditional withdrawal lands at $18,000 instead of $20,000, publishing $2,000 of penalties — the worksheet's third wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualFundingCandidateEvaluation.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualFundingCandidateEvaluation.evidence.test.ts > tax-penalties-annual — Annual penalties: early withdrawal plus the IRC 4974 excise > publishes 4000 of penalties on a real 2026 ledger row carrying both channels
AssertionError: traditional withdrawal 18000 is not within {"abs":0.005} of the worksheet's 20000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualFundingCandidateEvaluation.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualFundingCandidateEvaluation.ts` exited 0, confirming no change to production code after the run.
