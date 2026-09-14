# Mutation receipt: ladder-rung-flows-and-remaining-face

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
@@ -167,7 +167,7 @@ export function ladderRealFlowsAtOffset(rungs: readonly Readonly<LadderRung>[],
   let maturingPrincipal = 0
   let outstandingFace = 0
   for (const rung of rungs) {
-    if (rung.maturityOffset < offset) continue
+    if (rung.maturityOffset <= offset) continue
     outstandingFace += rung.face
     coupons += rung.face * (rung.couponRatePct / 100)
     if (rung.maturityOffset === offset) maturingPrincipal += rung.face
```

This excludes the maturing rung from the year it matures (`<=` instead of `<`), the first wrong reading in the worksheet: at offset 1 coupons become $6 instead of $8 and outstanding face $200 instead of $300, and the maturing principal is never counted. The first `expect` in the block reports 6 versus 8 under the exact tolerance. `ladder-backward-face-construction` in the same file also fails, because `buildLadder` publishes its income array through the same function.

## Command

```
npx vitest run src/ladder/ladderMath.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4impl/packages/engine
 ❯ src/ladder/ladderMath.evidence.test.ts (15 tests | 2 failed) 7ms
   ❯ ladder-backward-face-construction — Level-real-income ladder: faces solved back to front (4)
     × pays the level $110 target in both years and echoes the target 2ms
   ❯ ladder-rung-flows-and-remaining-face — Ladder cash flows in a year and face outstanding after it (3)
     × at offset 1: coupons $8, maturing $100, outstanding $300 with the maturing rung included 2ms
 Test Files  1 failed (1)
      Tests  2 failed | 13 passed (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > pays the level $110 target in both years and echoes the target
AssertionError: expected 100 to be less than or equal to 1e-9
 ❯ src/ladder/ladderMath.evidence.test.ts:194:59
    192|       expect(build.annualRealIncomeByOffset).toHaveLength(expectedInco…
    193|       build.annualRealIncomeByOffset.forEach((income, index) => {
    194|         expect(Math.abs(income - expectedIncome[index]!)).toBeLessThan…
       |                                                           ^
    195|       })
    196|       expect(build.targetAnnualRealIncome).toBe(example.expected.targe…
 ❯ src/ladder/ladderMath.evidence.test.ts:193:38
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-rung-flows-and-remaining-face — Ladder cash flows in a year and face outstanding after it > at offset 1: coupons $8, maturing $100, outstanding $300 with the maturing rung included
AssertionError: expected 6 to be 8 // Object.is equality
- Expected
+ Received
- 8
+ 6
 ❯ src/ladder/ladderMath.evidence.test.ts:240:29
    238|     it('at offset 1: coupons $8, maturing $100, outstanding $300 with …
    239|       const flows = ladderRealFlowsAtOffset(rungs, offset)
    240|       expect(flows.coupons).toBe(example.expected.coupons)
       |                             ^
    241|       expect(flows.maturingPrincipal).toBe(example.expected.maturingPr…
    242|       expect(flows.outstandingFace).toBe(example.expected.outstandingF…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

`git checkout -- packages/engine/src/ladder/ladderMath.ts`, then `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` exited 0, confirming no change to production code after the run.
