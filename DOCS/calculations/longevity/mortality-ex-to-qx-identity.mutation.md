# Mutation receipt: mortality-ex-to-qx-identity

Executed 2026-09-14 against RetireGolden head `efaeb827` (branch claude/b1-p4-cards-longevity) in `packages/engine`, with the PR #714 round-1 revision of `src/montecarlo/mortality.evidence.test.ts` applied: the planner-ui comparison moved to `packages/planner-ui/src/socialSecurity/expectedPv.mortalityParity.test.ts`, so the file carries 11 tests. This run replaces the same-day run against base `2dc2011c`.

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

This omits both half-year corrections, the worksheet's first wrong reading: q65 becomes 1 - 17.48/16.79 = -0.041, which the production clamp turns into 0, so the first assertion reports q(65) = 0 against the worksheet's 0.0179294389820704 at the 1e-12 tolerance, and the two-year survival in the same block reports 1. The sampled-death-age and joint-expectancy blocks in the same file fail as well, because every survival figure in the file reads q(x) through `annualMortality` (with q = 0 the death-age walk never dies and asks for a third draw the fixture does not supply). The planner-ui copy of the identity is no longer compared in this file; its parity test lives in the planner-ui suite and is outside this run.

## Command

```
npx vitest run src/montecarlo/mortality.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines and the `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4long/packages/engine
 ❯ src/montecarlo/mortality.evidence.test.ts (11 tests | 6 failed) 7ms
   ❯ mortality-ex-to-qx-identity — One-year death probability from SSA remaining life expectancy (4)
     × derives q(65), q(66), q(67) as 1 - (e(x) - 0.5)/(e(x+1) + 0.5) 3ms
     × two-year survival (1 - q65)(1 - q66) = 0.963150477964002 0ms
   ❯ mortality-sampled-death-age — Sampled death age: inverse-Bernoulli walk over annual death probabilities (3)
     × survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66 1ms
     × compares each draw against the q(x) the worksheet derives 0ms
   ❯ mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives (4)
     × two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years 0ms
     × one-year survival for either life at 118 is 0.04, and the endpoint forces zero survival after 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-ex-to-qx-identity — One-year death probability from SSA remaining life expectancy > derives q(65), q(66), q(67) as 1 - (e(x) - 0.5)/(e(x+1) + 0.5)
AssertionError: q(65) 0 is not within {"abs":1e-12} of the worksheet's 0.0179294389820704: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/montecarlo/mortality.evidence.test.ts:65:9
     63|         withinTolerance(q65, expectedQ65, example.tolerance),
     64|         `q(65) ${q65} is not within ${JSON.stringify(example.tolerance…
     65|       ).toBe(true)
       |         ^
     66|       expect(
     67|         withinTolerance(q66, expectedQ66, example.tolerance),
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-ex-to-qx-identity — One-year death probability from SSA remaining life expectancy > two-year survival (1 - q65)(1 - q66) = 0.963150477964002
AssertionError: twoYearSurvival 1 is not within {"abs":1e-12} of the worksheet's 0.963150477964002: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/montecarlo/mortality.evidence.test.ts:82:9
     80|         withinTolerance(survival, expected, example.tolerance),
     81|         `twoYearSurvival ${survival} is not within ${JSON.stringify(ex…
     82|       ).toBe(true)
       |         ^
     83|     })
     84|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-sampled-death-age — Sampled death age: inverse-Bernoulli walk over annual death probabilities > survives 65 on a 0.5 draw, dies in the age-66 interval on a 0.01 draw: returns 66
RangeError: the fixture supplies 2 draws; draw 2 was requested
 ❯ Object.next src/montecarlo/mortality.evidence.test.ts:13:37
     11|     next: () => {
     12|       const draw = draws[index]
     13|       if (draw === undefined) throw new RangeError(`the fixture suppli…
       |                                     ^
     14|       index += 1
     15|       return draw
 ❯ sampleDeathAge src/montecarlo/mortality.ts:46:13
 ❯ src/montecarlo/mortality.evidence.test.ts:121:14
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-sampled-death-age — Sampled death age: inverse-Bernoulli walk over annual death probabilities > compares each draw against the q(x) the worksheet derives
AssertionError: expected 0.01 to be less than 0
 ❯ src/montecarlo/mortality.evidence.test.ts:129:25
    127|       // The worksheet's two comparisons: 0.5 >= q65 (survive), 0.01 <…
    128|       expect(draws[0]!).toBeGreaterThanOrEqual(annualMortality(65, sex…
    129|       expect(draws[1]!).toBeLessThan(annualMortality(66, sex))
       |                         ^
    130|       // The fixture's tolerance is 'exact' for the integer death age;…
    131|       // worksheet's q(x) inputs are checked at the identity record's …
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > two male lives at 118: 0.5 + (1 - 0.96^2) = 0.5784 years
AssertionError: jointExpectancyYears 1.5 is not within {"abs":1e-12} of the worksheet's 0.5784: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/montecarlo/mortality.evidence.test.ts:185:9
    183|         withinTolerance(expectancy, expected, example.tolerance),
    184|         `jointExpectancyYears ${expectancy} is not within ${JSON.strin…
    185|       ).toBe(true)
       |         ^
    186|     })
    187|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯
 FAIL  src/montecarlo/mortality.evidence.test.ts > mortality-joint-last-survivor-expectancy — Joint last-survivor life expectancy of two independent lives > one-year survival for either life at 118 is 0.04, and the endpoint forces zero survival after
AssertionError: one-year survival at 118 1 is not within {"abs":1e-12} of the worksheet's 0.04: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/montecarlo/mortality.evidence.test.ts:194:9
    192|         withinTolerance(survivalAt118, 0.04, example.tolerance),
    193|         `one-year survival at 118 ${survivalAt118} is not within ${JSO…
    194|       ).toBe(true)
       |         ^
    195|       expect(annualMortality(ageA + 1, sexA)).toBe(1)
    196|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯
 Test Files  1 failed (1)
      Tests  6 failed | 5 passed (11)
```

## Revert

`git checkout -- packages/engine/src/montecarlo/mortality.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/mortality.ts` exited 0, confirming no change to production code after the run.
