# Mutation receipt: rmd-joint-life-divisor

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (rmd.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/rmd/rmd.evidence.test.ts (5 tests | 1 failed) 5ms
   ❯ rmd-joint-life-divisor — RMD joint-life divisor (2)
     × divides by the 28.3 joint-life entry for a 75-year-old owner and a 60-year-old spouse 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/rmd/rmd.evidence.test.ts > rmd-joint-life-divisor — RMD joint-life divisor > divides by the 28.3 joint-life entry for a 75-year-old owner and a 60-year-old spouse
AssertionError: rmd 10000 is not within {"abs":0.005} of the worksheet's 8692.58: expected false to be true // Object.is equality

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
 ❯ src/rmd/rmd.evidence.test.ts:106:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/rmd/rmd.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/rmd/rmd.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
