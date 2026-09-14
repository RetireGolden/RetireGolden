# Mutation receipt: mortality-sampled-death-age

Executed 2026-09-14 against RetireGolden head `efaeb827` (branch claude/b1-p4-cards-longevity) in `packages/engine`, with the PR #714 round-1 revision of `src/montecarlo/mortality.evidence.test.ts` applied (the planner-ui comparison moved to the planner-ui suite, so the file carries 11 tests). This run replaces the same-day run against base `2dc2011c`.

## Mutation applied to `packages/engine/src/montecarlo/mortality.ts`

```diff
@@ -43,7 +43,7 @@ export function annualMortality(age: number, sex: Sex): number {
 export function sampleDeathAge(rng: Rng, currentAge: number, sex: Sex): number {
   let age = Math.floor(Math.max(currentAge, 0))
   while (age < MAX_AGE) {
-    if (rng.next() < annualMortality(age, sex)) return age
+    if (rng.next() < annualMortality(age, sex)) return age + 1
     age++
   }
   return MAX_AGE
```

This returns the next birthday instead of the last full age alive, the worksheet's first wrong reading (off by one): the 0.01 draw at age 66 now yields 67. The draw count is unchanged, so only the age assertion fails.

## Command

```
npx vitest run src/montecarlo/mortality.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines and the `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4long/packages/engine
 ❯ src/montecarlo/mortality.evidence.test.ts (11 tests | 1 failed) 6ms
   ❯ mortality-sampled-death-age — Sampled death age: inverse-Bernoulli walk over annual death probabilities (3)
     × survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-sampled-death-age — Sampled death age: inverse-Bernoulli walk over annual death probabilities > survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66
AssertionError: expected 67 to be 66 // Object.is equality
- Expected
+ Received
- 66
+ 67
 ❯ src/montecarlo/mortality.evidence.test.ts:121:52
    119|     it('survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.…
    120|       const rng = drawsRng(draws)
    121|       expect(sampleDeathAge(rng, currentAge, sex)).toBe(example.expect…
       |                                                    ^
    122|       // One draw per year walked: exactly the two the worksheet suppl…
    123|       expect(rng.consumed()).toBe(draws.length)
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)
```

## Revert

`git checkout -- packages/engine/src/montecarlo/mortality.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/mortality.ts` exited 0, confirming no change to production code after the run.
