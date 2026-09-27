# Mutation receipt: survival-hazard-from-expectancy-multiplier

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/survival.ts`

```diff
@@ -109,7 +109,7 @@ export function jointSurvivalPercentileAge(
 function expectancyUnderHazard(age: number, sex: Sex, hazard: number): number {
   const from = Math.floor(Math.max(age, 0))
   let s = 1
-  let e = 0.5
+  let e = 0
   for (let a = from; a <= MAX_AGE; a++) {
     s *= annualSurvival(a, sex, hazard)
     e += s
```

This drops the half-year convention from the solver's expectancy: the bisection then solves sum S(t) = 17.48 instead of 0.5 + sum S(t) = 17.48, which needs a healthier curve, and lands at h = 0.9363, a 0.0637 miss against the 1e-6 tolerance. The adjusted expectancy recomputed with the convention at that power is 17.98, a 0.5 miss. The worksheet says its two named wrong readings both pass the identity case, so the mutation targets the convention the identity relies on instead.

## Command

```
npx vitest run src/montecarlo/survival.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because the test lines it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (survival.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/montecarlo/survival.evidence.test.ts (12 tests | 2 failed) 8ms
   ❯ survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection (3)
     × the identity multiplier m = 1 solves to hazard power 1 within 1e-6 4ms
     × the adjusted expectancy at the solved power reproduces the 17.48 baseline 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 10 passed (12)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection > the identity multiplier m = 1 solves to hazard power 1 within 1e-6
AssertionError: hazardPower 0.9363404188535241 is not within {"abs":0.000001} of the worksheet's 1: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:174:9
    172|         withinTolerance(hazard, expected, example.tolerance),
    173|         `hazardPower ${hazard} is not within ${JSON.stringify(example.…
    174|       ).toBe(true)
       |         ^
    175|     })
    176|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection > the adjusted expectancy at the solved power reproduces the 17.48 baseline
AssertionError: adjustedExpectancyYears 17.98000000001623 is not within {"abs":0.000001} of the worksheet's 17.48: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:194:9
    192|         withinTolerance(expectancy, expected, example.tolerance),
    193|         `adjustedExpectancyYears ${expectancy} is not within ${JSON.st…
    194|       ).toBe(true)
       |         ^
    195|     })
    196|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/survival.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
