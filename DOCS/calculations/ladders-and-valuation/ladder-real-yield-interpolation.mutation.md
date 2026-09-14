# Mutation receipt: ladder-real-yield-interpolation

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
@@ -41,7 +41,7 @@ export function realYieldAt(curve: RealYieldCurve, maturityYears: number): numbe
     const hi = points[i]!
     if (maturityYears <= hi.maturityYears) {
       const t = (maturityYears - lo.maturityYears) / (hi.maturityYears - lo.maturityYears)
-      return lo.realYieldPct + t * (hi.realYieldPct - lo.realYieldPct)
+      return t < 0.5 ? lo.realYieldPct : hi.realYieldPct
     }
   }
   return last.realYieldPct
```

This replaces linear interpolation with nearest-neighbor selection, the first wrong reading in the worksheet: at 7 years the interior fraction is 2/5, so the mutated code returns the 5-year knot's 2% instead of 2.4%, a 0.4 percentage-point miss against the 1e-12 tolerance. The endpoint holds are untouched, so the flat-endpoint assertions still pass; `ladder-real-present-value` in the same file also fails because `realPresentValue` discounts on the same interpolation.

## Command

```
npx vitest run src/ladder/ladderMath.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4impl/packages/engine
 ❯ src/ladder/ladderMath.evidence.test.ts (15 tests | 2 failed) 6ms
   ❯ ladder-real-yield-interpolation — Par real yield at a maturity: linear interpolation with flat endpoints (3)
     × interpolates 2.4% at 7 years between (5y, 2%) and (10y, 3%) 2ms
   ❯ ladder-real-present-value — Real present value of a cash-flow stream on the TIPS curve (2)
     × discounts $100 at 2 years (interpolated 2%) plus $100 at 4 years (flat 3%) to $184.9655829154 0ms
 Test Files  1 failed (1)
      Tests  2 failed | 13 passed (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-real-yield-interpolation — Par real yield at a maturity: linear interpolation with flat endpoints > interpolates 2.4% at 7 years between (5y, 2%) and (10y, 3%)
AssertionError: expected 0.3999999999999999 to be less than or equal to 1e-12
 ❯ src/ladder/ladderMath.evidence.test.ts:44:82
     42|     it('interpolates 2.4% at 7 years between (5y, 2%) and (10y, 3%)', …
     43|       const yieldPct = realYieldAt(curve, example.inputs.interiorMatur…
     44|       expect(Math.abs(yieldPct - (example.expected.interiorYieldPct as…
       |                                                                                  ^
     45|     })
     46|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-real-present-value — Real present value of a cash-flow stream on the TIPS curve > discounts $100 at 2 years (interpolated 2%) plus $100 at 4 years (flat 3%) to $184.9655829154
AssertionError: expected 1.857287210455695 to be less than or equal to 1e-9
 ❯ src/ladder/ladderMath.evidence.test.ts:146:76
    144|     it('discounts $100 at 2 years (interpolated 2%) plus $100 at 4 yea…
    145|       const pv = realPresentValue(flows, curve)
    146|       expect(Math.abs(pv - (example.expected.realPresentValue as numbe…
       |                                                                            ^
    147|     })
    148|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

`git checkout -- packages/engine/src/ladder/ladderMath.ts`, then `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` exited 0, confirming no change to production code after the run.
