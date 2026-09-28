# Mutation receipt: mortality-published-death-probability

Executed 2026-09-28 against RetireGolden base `2a93de55` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `476abd6e` (branch `claude/life-table-2023`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/deathProbability.ts`

```diff
@@ -40,7 +40,7 @@
   }
   const x = Math.floor(age)
   if (x < 0) return 0
-  if (x >= MAX_AGE) return 1
+  if (x > MAX_AGE) return 1
   return SSA_PERIOD_LIFE_TABLE[sex].q[x] ?? Number.NaN
 }
 
```

This opens the table's last row, in the leaf where the death probability now lives (montecarlo/deathProbability.ts, which montecarlo/mortality.ts re-exports): at 119 the function reads SSA's printed q(119), 0.926604, instead of the closed row's 1, the worksheet's second wrong reading. The table-end assertion fails on it, and so does every joint-expectancy case that reaches 119: two men of 118 now have a chance of 1 - 0.926604 = 0.073396 of surviving 119, past every horizon the engine has, so the joint expectancy of two men of 118 is no longer 0.7212290496 and two lives at 119 no longer give exactly 0.5.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/mortality.evidence.test.ts
```

## Captured failing output

Re-executed after the D-LIFE-TABLE-2023 review fixes (the death probability in a leaf module, the new evidence cases). The baseline is green (mortality.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine15/packages/engine

 ❯ src/montecarlo/mortality.evidence.test.ts (16 tests | 6 failed) 192ms
   ❯ mortality-published-death-probability — One-year death probability: SSA's published q(x) (4)
     × closes the table at 119: 1 at 119 and 130, although SSA prints 0.926604 at 119; 0 below age 0 4ms
   ❯ mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives (5)
     × two male lives at 118: 0.5 + (1 - 0.88248^2) = 0.7212290496 years 1ms
     × one-year survival for either life at 118 is 1 - 0.88248 = 0.11752, and the closed last row forces zero survival after 0ms
     × a man of 70 and a woman of 67: 21.80655867930931 years; two 'average' lives of those ages: the mean of the four sex pairings, 21.52705755500049 0ms
     × floors fractional ages, and a negative age survives with certainty until it reaches 0 0ms
     × at the table endpoint both lives die within the year: exactly the 0.5 convention 0ms

 Test Files  1 failed (1)
      Tests  6 failed | 10 passed (16)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-published-death-probability — One-year death probability: SSA's published q(x) > closes the table at 119: 1 at 119 and 130, although SSA prints 0.926604 at 119; 0 below age 0
AssertionError: expected 0.926604 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 0.926604

 ❯ src/montecarlo/mortality.evidence.test.ts:105:47
    103|       expect(MAX_AGE).toBe(119)
    104|       for (const sex of ['male', 'female'] as const) {
    105|         expect(annualMortality(MAX_AGE, sex)).toBe(expected.at119)
       |                                               ^
    106|         expect(annualMortality(130, sex)).toBe(expected.at130)
    107|         expect(annualMortality(-1, sex)).toBe(expected.belowZero)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > two male lives at 118: 0.5 + (1 - 0.88248^2) = 0.7212290496 years
AssertionError: jointExpectancyYears 0.738405646225632 is not within {"abs":1e-12} of the worksheet's 0.7212290496: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/mortality.evidence.test.ts:257:9
    255|         withinTolerance(expectancy, expected, example.tolerance),
    256|         `jointExpectancyYears ${expectancy} is not within ${JSON.strin…
    257|       ).toBe(true)
       |         ^
    258|     })
    259|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > one-year survival for either life at 118 is 1 - 0.88248 = 0.11752, and the closed last row forces zero survival after
AssertionError: expected 0.008625497919999999 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 0.008625497919999999

 ❯ src/montecarlo/mortality.evidence.test.ts:264:55
    262|       const survivalAt118 = survivalCurve(ageA, sexA).survivalTo(1)
    263|       expect(withinTolerance(survivalAt118, jointValue('One-year survi…
    264|       expect(survivalCurve(ageA, sexA).survivalTo(2)).toBe(0)
       |                                                       ^
    265|     })
    266|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > a man of 70 and a woman of 67: 21.80655867930931 years; two 'average' lives of those ages: the mean of the four sex pairings, 21.52705755500049
AssertionError: 70/67: 21.80655867934071: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/mortality.evidence.test.ts:269:111
    267|     it('a man of 70 and a woman of 67: 21.80655867930931 years; two \'…
    268|       const mixed = jointLastSurvivorExpectancy(70, 'male', 67, 'femal…
    269|       expect(withinTolerance(mixed, jointValue('Man of 70, woman of 67…
       |                                                                                                               ^
    270|       const bothAverage = jointLastSurvivorExpectancy(70, 'average', 6…
    271|       expect(withinTolerance(bothAverage, jointValue('Two \'average\' …

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > floors fractional ages, and a negative age survives with certainty until it reaches 0
AssertionError: 0.738405646225632: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/mortality.evidence.test.ts:282:130
    280|     it('floors fractional ages, and a negative age survives with certa…
    281|       const floored = jointLastSurvivorExpectancy(118.7, 'male', 118.2…
    282|       expect(withinTolerance(floored, jointValue('Two men of 118.7 and…
       |                                                                                                                                  ^
    283|       expect(floored).toBe(jointLastSurvivorExpectancy(118, 'male', 11…
    284|       const negative = jointLastSurvivorExpectancy(-2, 'male', 118, 'm…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > at the table endpoint both lives die within the year: exactly the 0.5 convention
AssertionError: expected 0.641405027184 to be 0.5 // Object.is equality

- Expected
+ Received

- 0.5
+ 0.641405027184

 ❯ src/montecarlo/mortality.evidence.test.ts:290:73
    288|     it('at the table endpoint both lives die within the year: exactly …
    289|       // Degenerate case: the closed last row makes both survivals 0 f…
    290|       expect(jointLastSurvivorExpectancy(MAX_AGE, sexA, MAX_AGE, sexB)…
       |                                                                         ^
    291|       expect(jointLastSurvivorExpectancy(MAX_AGE, 'average', MAX_AGE, …
    292|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/deathProbability.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/deathProbability.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
