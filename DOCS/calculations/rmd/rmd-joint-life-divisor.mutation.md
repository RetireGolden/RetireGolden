# Mutation receipt: rmd-joint-life-divisor

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/rmd/rmd.ts`

```diff
@@ -46,7 +46,7 @@ export function requiredMinimumDistribution(
   // Joint Life & Last Survivor table when the spouse beneficiary is >10 yrs younger.
   if (opts.spouse && ageAttained - opts.spouse.ageAttained > 10) {
     const joint = jointLifeTableDivisor(ageAttained, opts.spouse.ageAttained)
-    if (joint !== undefined) divisor = Math.max(divisor, joint)
+    if (joint !== undefined) divisor = Math.min(divisor, joint)
   }
   return priorYearEndBalance / divisor
 }
```

This takes the smaller of the Uniform and joint-life divisors, so the qualifying spouse never lowers the RMD and the age-75 Uniform divisor 24.6 publishes $10,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/rmd/rmd.evidence.test.ts
```

## Captured failing output

```
FAIL  src/rmd/rmd.evidence.test.ts > rmd-joint-life-divisor — RMD joint-life divisor > divides by the 28.3 joint-life entry for a 75-year-old owner and a 60-year-old spouse
AssertionError: rmd 10000 is not within {"abs":0.005} of the worksheet's 8692.58: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/rmd/rmd.ts`, then `git diff --quiet -- packages/engine/src/rmd/rmd.ts` exited 0, confirming no change to production code after the run.
