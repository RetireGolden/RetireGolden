# Mutation receipt: mortality-ex-to-qx-identity

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/mortality.ts`

```diff
@@ -30,7 +30,7 @@ export function annualMortality(age: number, sex: Sex): number {
   const x = Math.floor(age)
   if (x < 0) return 0
   if (x >= t.length - 1) return 1
-  const survival = (t[x]! - 0.5) / (t[x + 1]! + 0.5)
+  const survival = t[x]! / t[x + 1]!
   return Math.min(1, Math.max(0, 1 - survival))
 }
 
```

This omits both half-year corrections, the worksheet's first wrong reading: q65 becomes 1 - 17.48/16.79 = -0.041, which the production clamp turns into 0, so the first assertion reports the whole 0.0179294389820704 as the miss against the 1e-12 tolerance. The two-year survival and the planner-ui comparison in the same block fail with it: the UI copy still applies the corrections, so the two implementations now disagree by exactly q65. The sampled-death-age and joint-expectancy blocks in the same file fail as well, because every survival figure in the file reads q(x) through `annualMortality` (with q = 0 the death-age walk never dies and asks for a third draw the fixture does not supply).

## Command

```
npx vitest run src/montecarlo/mortality.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines and the `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4long/packages/engine
 ❯ src/montecarlo/mortality.evidence.test.ts (12 tests | 7 failed) 43ms
   ❯ mortality-ex-to-qx-identity — One-year death probability from SSA remaining life expectancy (5)
     × derives q(65), q(66), q(67) as 1 - (e(x) - 0.5)/(e(x+1) + 0.5) 2ms
     × two-year survival (1 - q65)(1 - q66) = 0.963150477964002 0ms
     × agrees with the planner-ui copy in socialSecurity/expectedPv.ts within 1e-12 for the same rows 38ms
   ❯ mortality-sampled-death-age — Sampled death age: inverse-Bernoulli walk over annual death probabilities (3)
     × survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66 1ms
     × compares each draw against the q(x) the worksheet derives 0ms
   ❯ mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives (4)
     × two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years 0ms
     × one-year survival for either life at 118 is 0.04, and the endpoint forces zero survival after 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-ex-to-qx-identity — One-year death probability from SSA remaining life expectancy > derives q(65), q(66), q(67) as 1 - (e(x) - 0.5)/(e(x+1) + 0.5)
AssertionError: expected 0.0179294389820704 to be less than or equal to 1e-12
 ❯ src/montecarlo/mortality.evidence.test.ts:82:85
     80|
     81|     it('derives q(65), q(66), q(67) as 1 - (e(x) - 0.5)/(e(x+1) + 0.5)…
     82|       expect(Math.abs(annualMortality(65, sex) - (example.expected.q65…
       |                                                                                     ^
     83|       expect(Math.abs(annualMortality(66, sex) - (example.expected.q66…
     84|       expect(Math.abs(annualMortality(67, sex) - (example.expected.q67…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/7]⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-ex-to-qx-identity — One-year death probability from SSA remaining life expectancy > two-year survival (1 - q65)(1 - q66) = 0.963150477964002
AssertionError: expected 0.036849522035998006 to be less than or equal to 1e-12
 ❯ src/montecarlo/mortality.evidence.test.ts:89:81
     87|     it('two-year survival (1 - q65)(1 - q66) = 0.963150477964002', () …
     88|       const survival = (1 - annualMortality(65, sex)) * (1 - annualMor…
     89|       expect(Math.abs(survival - (example.expected.twoYearSurvival as …
       |                                                                                 ^
     90|     })
     91|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/7]⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-ex-to-qx-identity — One-year death probability from SSA remaining life expectancy > agrees with the planner-ui copy in socialSecurity/expectedPv.ts within 1e-12 for the same rows
AssertionError: expected 0.017929438982070445 to be less than or equal to 1e-12
 ❯ src/montecarlo/mortality.evidence.test.ts:108:55
    106|         const uiSurvival = curve.survival(age, age + 1)
    107|         const engineSurvival = 1 - annualMortality(age, sex)
    108|         expect(Math.abs(uiSurvival - engineSurvival)).toBeLessThanOrEq…
       |                                                       ^
    109|       }
    110|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/7]⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-sampled-death-age — Sampled death age: inverse-Bernoulli walk over annual death probabilities > survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66
RangeError: the fixture supplies 2 draws; draw 2 was requested
 ❯ Object.next src/montecarlo/mortality.evidence.test.ts:38:37
     36|     next: () => {
     37|       const draw = draws[index]
     38|       if (draw === undefined) throw new RangeError(`the fixture suppli…
       |                                     ^
     39|       index += 1
     40|       return draw
 ❯ sampleDeathAge src/montecarlo/mortality.ts:46:13
 ❯ src/montecarlo/mortality.evidence.test.ts:138:14
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/7]⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-sampled-death-age — Sampled death age: inverse-Bernoulli walk over annual death probabilities > compares each draw against the q(x) the worksheet derives
AssertionError: expected 0.01 to be less than 0
 ❯ src/montecarlo/mortality.evidence.test.ts:146:25
    144|       // The worksheet's two comparisons: 0.5 >= q65 (survive), 0.01 <…
    145|       expect(draws[0]!).toBeGreaterThanOrEqual(annualMortality(65, sex…
    146|       expect(draws[1]!).toBeLessThan(annualMortality(66, sex))
       |                         ^
    147|       expect(Math.abs(annualMortality(65, sex) - (example.inputs.q65 a…
    148|       expect(Math.abs(annualMortality(66, sex) - (example.inputs.q66 a…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/7]⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years
AssertionError: expected 0.9216 to be less than or equal to 1e-12
 ❯ src/montecarlo/mortality.evidence.test.ts:187:88
    185|     it('two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years', () …
    186|       const expectancy = jointLastSurvivorExpectancy(ageA, sexA, ageB,…
    187|       expect(Math.abs(expectancy - (example.expected.jointExpectancyYe…
       |                                                                                        ^
    188|     })
    189|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/7]⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > one-year survival for either life at 118 is 0.04, and the endpoint forces zero survival after
AssertionError: expected 0.96 to be less than or equal to 1e-12
 ❯ src/montecarlo/mortality.evidence.test.ts:192:64
    190|     it('one-year survival for either life at 118 is 0.04, and the endp…
    191|       // The worksheet's intermediate: (0.54 - 0.5)/(0.50 + 0.5) = 0.0…
    192|       expect(Math.abs(1 - annualMortality(ageA, sexA) - 0.04)).toBeLes…
       |                                                                ^
    193|       expect(annualMortality(ageA + 1, sexA)).toBe(1)
    194|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/7]⎯
 Test Files  1 failed (1)
      Tests  7 failed | 5 passed (12)
```

## Revert

`git checkout -- packages/engine/src/montecarlo/mortality.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/mortality.ts` exited 0, confirming no change to production code after the run.
