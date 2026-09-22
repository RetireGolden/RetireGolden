# Mutation receipt: rmd-uniform-lifetime-divisor

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/rmd/rmd.ts`

```diff
@@ -41,7 +41,7 @@ export function requiredMinimumDistribution(
 ): number {
   if (priorYearEndBalance <= 0) return 0
   if (ageAttained < rmdStartAgeForBirthYear(birthYear)) return 0
-  let divisor = uniformLifetimeDivisor(pack, ageAttained)
+  let divisor = uniformLifetimeDivisor(pack, ageAttained - 1)
   if (divisor === undefined || divisor <= 0) return 0
   // Joint Life & Last Survivor table when the spouse beneficiary is >10 yrs younger.
   if (opts.spouse && ageAttained - opts.spouse.ageAttained > 10) {
```

This reads the table one age early, using the age-74 divisor 25.5 to publish $9,647.06 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/rmd/rmd.evidence.test.ts
```

## Captured failing output

```
FAIL  src/rmd/rmd.evidence.test.ts > rmd-uniform-lifetime-divisor — RMD uniform lifetime divisor > divides the 246,000 prior year-end balance by the age-75 divisor 24.6
AssertionError: rmd 9647.058823529413 is not within "exact" of the worksheet's 10000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/rmd/rmd.ts`, then `git diff --quiet -- packages/engine/src/rmd/rmd.ts` exited 0, confirming no change to production code after the run.
