# Mutation receipt: ladder-backward-face-construction

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
@@ -120,7 +120,7 @@ export function buildLadder(input: LadderBuildInput): LadderBuild {
       const later = offsets[j]!
       laterCoupons += (faces.get(later) ?? 0) * couponRate(later)
     }
-    faces.set(m, Math.max(0, (annualRealIncome - laterCoupons) / (1 + couponRate(m))))
+    faces.set(m, Math.max(0, annualRealIncome))
   }
 
   const rungs: LadderRung[] = offsets.map((m) => {
```

This sets every face to the target income, ignoring coupons and the later rungs' contributions, the first wrong reading in the worksheet: faces become [110, 110] instead of [1000/11, 100], year-1 income $132 and year-2 income $121 instead of $110, and total cost $220 instead of 2100/11. Every assertion of the record fails (misses 19.0909, 22, 29.0909 and 22 against 1e-9). `ladder-annual-coupon-par-pricing` in the same file also fails on its face precondition, because its one-rung ladder now solves face $1,020 instead of $1,000.

## Command

```
npx vitest run src/ladder/ladderMath.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4impl/packages/engine
 ❯ src/ladder/ladderMath.evidence.test.ts (15 tests | 5 failed) 6ms
   ❯ ladder-annual-coupon-par-pricing — Synthetic TIPS rung: floored coupon and par-curve price (3)
     × prices a $1,000 face, 2% coupon, 3-year rung at par on a flat 2% curve 2ms
   ❯ ladder-backward-face-construction — Level-real-income ladder: faces solved back to front (4)
     × solves faces [1000/11, 100] back to front on a flat 10% curve 1ms
     × pays the level $110 target in both years and echoes the target 0ms
     × prices each par rung at face, so total cost is 2100/11 0ms
     × year 1 receipt is 1.1·F1 + 0.1·F2 from the returned faces 0ms
 Test Files  1 failed (1)
      Tests  5 failed | 10 passed (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-annual-coupon-par-pricing — Synthetic TIPS rung: floored coupon and par-curve price > prices a $1,000 face, 2% coupon, 3-year rung at par on a flat 2% curve
AssertionError: expected 20 to be less than or equal to 1e-9
 ❯ src/ladder/ladderMath.evidence.test.ts:98:42
     96|       const rung = build.rungs[0]!
     97|       expect(rung.maturityOffset).toBe(maturityYears)
     98|       expect(Math.abs(rung.face - face)).toBeLessThanOrEqual(abs)
       |                                          ^
     99|       expect(Math.abs(rung.cost - (example.expected.rungCost as number…
    100|       expect(Math.abs(build.totalCost - (example.expected.rungCost as …
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > solves faces [1000/11, 100] back to front on a flat 10% curve
AssertionError: expected 19.0909090909 to be less than or equal to 1e-9
 ❯ src/ladder/ladderMath.evidence.test.ts:186:61
    184|       expect(build.rungs.map((rung) => rung.maturityOffset)).toEqual([…
    185|       build.rungs.forEach((rung, index) => {
    186|         expect(Math.abs(rung.face - expectedFaces[index]!)).toBeLessTh…
       |                                                             ^
    187|       })
    188|     })
 ❯ src/ladder/ladderMath.evidence.test.ts:185:19
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > pays the level $110 target in both years and echoes the target
AssertionError: expected 22 to be less than or equal to 1e-9
 ❯ src/ladder/ladderMath.evidence.test.ts:194:59
    192|       expect(build.annualRealIncomeByOffset).toHaveLength(expectedInco…
    193|       build.annualRealIncomeByOffset.forEach((income, index) => {
    194|         expect(Math.abs(income - expectedIncome[index]!)).toBeLessThan…
       |                                                           ^
    195|       })
    196|       expect(build.targetAnnualRealIncome).toBe(example.expected.targe…
 ❯ src/ladder/ladderMath.evidence.test.ts:193:38
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > prices each par rung at face, so total cost is 2100/11
AssertionError: expected 29.09090909089997 to be less than or equal to 1e-9
 ❯ src/ladder/ladderMath.evidence.test.ts:200:82
    198|
    199|     it('prices each par rung at face, so total cost is 2100/11', () =>…
    200|       expect(Math.abs(build.totalCost - (example.expected.totalCost as…
       |                                                                                  ^
    201|     })
    202|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > year 1 receipt is 1.1·F1 + 0.1·F2 from the returned faces
AssertionError: expected 22 to be less than or equal to 1e-9
 ❯ src/ladder/ladderMath.evidence.test.ts:208:79
    206|       const [first, second] = build.rungs
    207|       const receipt = first!.face * (1 + yieldPct / 100) + second!.fac…
    208|       expect(Math.abs(receipt - (example.inputs.annualRealIncome as nu…
       |                                                                               ^
    209|     })
    210|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

`git checkout -- packages/engine/src/ladder/ladderMath.ts`, then `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` exited 0, confirming no change to production code after the run.
