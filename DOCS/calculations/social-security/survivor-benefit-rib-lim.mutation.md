# Mutation receipt: survivor-benefit-rib-lim

Executed 2026-09-27 against RetireGolden base `7e21cd29` (branch `claude/social-security-law-2`; no pull request is open yet) for the restatement under decision D-SS-LAW-2, replacing the mutation this receipt carried until then (it dropped the widow-limit floor from code the restatement removed), and re-executed 2026-09-27 against RetireGolden base `4dd40692` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b338e430` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/survivorBenefit.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/survivorBenefit.ts b/packages/engine/src/socialSecurity/survivorBenefit.ts
index 5c18cee8..94c6ad9b 100644
--- a/packages/engine/src/socialSecurity/survivorBenefit.ts
+++ b/packages/engine/src/socialSecurity/survivorBenefit.ts
@@ -102,7 +102,7 @@ export function survivorBenefitMonthly(input: SurvivorBenefitInput): number {
   if (input.deceasedPiaMonthly <= 0) return 0
   const ageMonths = input.survivorClaimAge.years * 12 + input.survivorClaimAge.months
   const reduced =
-    Math.max(input.deceasedPiaMonthly, input.deceasedActualMonthly) *
+    Math.max(input.deceasedActualMonthly, WIDOW_LIMIT_PIA_FRACTION * input.deceasedPiaMonthly) *
     survivorReductionFactor(ageMonths, input.survivorFraMonths)
   if (!(input.deceasedEverReduced ?? input.deceasedActualMonthly < input.deceasedPiaMonthly)) return reduced
   return Math.min(
```

This takes the widow's limit as the base and reduces it for age, the order the engine used until 2026-09-27, publishing $1,576.93 in case A, $1,414.875 in case B and $1,179.75 in case C: the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/survivorBenefit.evidence.test.ts
```

## Captured failing output

Re-executed for B2-P1 slice 4 because a comment above its hunk or in its test file changed (the planner-ui copy of the survival curve is deleted, and the survivor helper names its two analysis callers); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (survivorBenefit.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/socialSecurity/survivorBenefit.evidence.test.ts (6 tests | 3 failed) 6ms
   ❯ survivor-benefit-rib-lim — Survivor benefit under RIB-LIM (6)
     × case A: reduces for age first, and the limit does not bind at 62 (1,911.43, not 1,576.93) 4ms
     × case B: the POMS case is cut to the larger limit after the age reduction (1,650, not 1,414.875) 0ms
     × case C: at 60 the reduced PIA is paid, below the limit (1,430, not 1,179.75) 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/survivorBenefit.evidence.test.ts > survivor-benefit-rib-lim — Survivor benefit under RIB-LIM > case A: reduces for age first, and the limit does not bind at 62 (1,911.43, not 1,576.93)
AssertionError: caseA62 1576.9285714285716 is not within {"abs":0.005} of the worksheet's 1911.43: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/survivorBenefit.evidence.test.ts:35:5
     33|     withinTolerance(actual, expected, tolerance),
     34|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     35|   ).toBe(true)
       |     ^
     36| }
     37|
 ❯ src/socialSecurity/survivorBenefit.evidence.test.ts:88:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/socialSecurity/survivorBenefit.evidence.test.ts > survivor-benefit-rib-lim — Survivor benefit under RIB-LIM > case B: the POMS case is cut to the larger limit after the age reduction (1,650, not 1,414.875)
AssertionError: caseB 1414.875 is not within {"abs":0.005} of the worksheet's 1650: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/survivorBenefit.evidence.test.ts:35:5
     33|     withinTolerance(actual, expected, tolerance),
     34|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     35|   ).toBe(true)
       |     ^
     36| }
     37|
 ❯ src/socialSecurity/survivorBenefit.evidence.test.ts:99:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/socialSecurity/survivorBenefit.evidence.test.ts > survivor-benefit-rib-lim — Survivor benefit under RIB-LIM > case C: at 60 the reduced PIA is paid, below the limit (1,430, not 1,179.75)
AssertionError: caseC 1179.7500000000002 is not within {"abs":0.005} of the worksheet's 1430: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/survivorBenefit.evidence.test.ts:35:5
     33|     withinTolerance(actual, expected, tolerance),
     34|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     35|   ).toBe(true)
       |     ^
     36| }
     37|
 ❯ src/socialSecurity/survivorBenefit.evidence.test.ts:105:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/survivorBenefit.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/survivorBenefit.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
