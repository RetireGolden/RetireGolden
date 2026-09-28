# Mutation receipt: mortality-sampled-death-age

Executed 2026-09-14 against RetireGolden head `efaeb827` (branch claude/b1-p4-cards-longevity, with the PR #714 round-1 revision of `src/montecarlo/mortality.evidence.test.ts` applied: the planner-ui comparison moved to the planner-ui suite, and B2-P1 slice 4 deleted it with the planner-ui copy of the identity; that run replaced the same-day run against base `2dc2011c`), and re-executed 2026-09-27 against RetireGolden base `b338e430` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

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

Re-executed for B2-P1 slice 4 because a comment above its hunk or in its test file changed (the planner-ui copy of the survival curve is deleted, and the survivor helper names its two analysis callers); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (mortality.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine13/packages/engine

 ❯ src/montecarlo/mortality.evidence.test.ts (11 tests | 1 failed) 6ms
   ❯ mortality-sampled-death-age — Sampled death age: inverse-Bernoulli walk over annual death probabilities (3)
     × survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 10 passed (11)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-sampled-death-age — Sampled death age: inverse-Bernoulli walk over annual death probabilities > survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66
AssertionError: expected 67 to be 66 // Object.is equality

- Expected
+ Received

- 66
+ 67

 ❯ src/montecarlo/mortality.evidence.test.ts:120:52
    118|     it('survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.…
    119|       const rng = drawsRng(draws)
    120|       expect(sampleDeathAge(rng, currentAge, sex)).toBe(example.expect…
       |                                                    ^
    121|       // One draw per year walked: exactly the two the worksheet suppl…
    122|       expect(rng.consumed()).toBe(draws.length)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/mortality.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/mortality.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
