# Mutation receipt: rmd-uniform-lifetime-divisor

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (rmd.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/rmd/rmd.evidence.test.ts (5 tests | 2 failed) 6ms
   ❯ rmd-uniform-lifetime-divisor — RMD uniform lifetime divisor (3)
     × divides the 246,000 prior year-end balance by the age-75 divisor 24.6 4ms
   ❯ rmd-joint-life-divisor — RMD joint-life divisor (2)
     × keeps the Uniform divisor when the gap is exactly ten years 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/rmd/rmd.evidence.test.ts > rmd-uniform-lifetime-divisor — RMD uniform lifetime divisor > divides the 246,000 prior year-end balance by the age-75 divisor 24.6
AssertionError: rmd 9647.058823529413 is not within "exact" of the worksheet's 10000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/rmd/rmd.evidence.test.ts:19:5
     17|     withinTolerance(actual, expected, tolerance),
     18|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     19|   ).toBe(true)
       |     ^
     20| }
     21|
 ❯ src/rmd/rmd.evidence.test.ts:51:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/rmd/rmd.evidence.test.ts > rmd-joint-life-divisor — RMD joint-life divisor > keeps the Uniform divisor when the gap is exactly ten years
AssertionError: rmd at a ten-year gap 9647.058823529413 is not within {"abs":0.005} of the worksheet's 10000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/rmd/rmd.evidence.test.ts:19:5
     17|     withinTolerance(actual, expected, tolerance),
     18|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     19|   ).toBe(true)
       |     ^
     20| }
     21|
 ❯ src/rmd/rmd.evidence.test.ts:118:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/rmd/rmd.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/rmd/rmd.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
