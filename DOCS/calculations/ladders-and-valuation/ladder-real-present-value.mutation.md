# Mutation receipt: ladder-real-present-value

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
@@ -199,7 +199,7 @@ export function realPresentValue(flows: Array<{ yearsFromNow: number; realAmount
       pv += flow.realAmount
       continue
     }
-    const y = realYieldAt(curve, flow.yearsFromNow) / 100
+    const y = curve.points[curve.points.length - 1]!.realYieldPct / 100
     pv += flow.realAmount / Math.pow(1 + y, flow.yearsFromNow)
   }
   return pv
```

This discounts every flow at the curve's last point instead of the interpolated yield for its own maturity, the first wrong reading in the worksheet: with 3% applied to both flows the present value is $183.1082957049 instead of $184.9655829154, a $1.8572872105 miss against the 1e-9 tolerance. The t = 0 boundary still passes because that branch never reaches the discount.

## Command

```
npx vitest run src/ladder/ladderMath.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4impl/packages/engine
 ❯ src/ladder/ladderMath.evidence.test.ts (15 tests | 1 failed) 6ms
   ❯ ladder-real-present-value — Real present value of a cash-flow stream on the TIPS curve (2)
     × discounts $100 at 2 years (interpolated 2%) plus $100 at 4 years (flat 3%) to $184.9655829154 2ms
 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-real-present-value — Real present value of a cash-flow stream on the TIPS curve > discounts $100 at 2 years (interpolated 2%) plus $100 at 4 years (flat 3%) to $184.9655829154
AssertionError: expected 1.857287210455695 to be less than or equal to 1e-9
 ❯ src/ladder/ladderMath.evidence.test.ts:146:76
    144|     it('discounts $100 at 2 years (interpolated 2%) plus $100 at 4 yea…
    145|       const pv = realPresentValue(flows, curve)
    146|       expect(Math.abs(pv - (example.expected.realPresentValue as numbe…
       |                                                                            ^
    147|     })
    148|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/ladder/ladderMath.ts`, then `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` exited 0, confirming no change to production code after the run.
