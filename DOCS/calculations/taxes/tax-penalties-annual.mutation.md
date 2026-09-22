# Mutation receipt: tax-penalties-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualFundingCandidateEvaluation.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualFundingCandidateEvaluation.evidence.test.ts (4 tests | 1 failed) 31ms
   ❯ tax-penalties-annual — Annual penalties: early withdrawal plus the IRC 4974 excise (4)
     × publishes 4000 of penalties on a real 2026 ledger row carrying both channels 29ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

  Transform  transforming modules took 2.44s · 43% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualFundingCandidateEvaluation.evidence.test.ts > tax-penalties-annual — Annual penalties: early withdrawal plus the IRC 4974 excise > publishes 4000 of penalties on a real 2026 ledger row carrying both channels
AssertionError: traditional withdrawal 18000 is not within {"abs":0.005} of the worksheet's 20000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualFundingCandidateEvaluation.evidence.test.ts:31:5
     29|     withinTolerance(actual, target, tolerance),
     30|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     31|   ).toBe(true)
       |     ^
     32| }
     33|
 ❯ src/projection/internal/annualFundingCandidateEvaluation.evidence.test.ts:213:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualFundingCandidateEvaluation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualFundingCandidateEvaluation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
