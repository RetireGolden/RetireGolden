# Mutation receipt: ladder-annual-coupon-par-pricing

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
@@ -87,7 +87,7 @@ function priceRung(face: number, couponRatePct: number, maturityOffset: number,
   let price = 0
   for (let k = 1; k <= maturityOffset; k++) {
     const y = realYieldAt(curve, k) / 100
-    const coupon = face * (couponRatePct / 100)
+    const coupon = 0
     const principal = k === maturityOffset ? face : 0
     price += (coupon + principal) / Math.pow(1 + y, k)
   }
```

This makes `priceRung` discount principal only, the first wrong reading in the worksheet: for a $1,000 face, 2% coupon, 3-year rung on a flat 2% curve the price becomes 1000/1.02^3 = $942.3223345470 instead of par, a $57.6776654530 miss against the 1e-9 tolerance. The coupon-rate assertions are untouched. `ladder-backward-face-construction` in the same file also fails on its total cost, which sums the same rung prices.

## Command

```
npx vitest run src/ladder/ladderMath.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4impl/packages/engine
 ❯ src/ladder/ladderMath.evidence.test.ts (15 tests | 2 failed) 6ms
   ❯ ladder-annual-coupon-par-pricing — Synthetic TIPS rung: floored coupon and par-curve price (3)
     × prices a $1,000 face, 2% coupon, 3-year rung at par on a flat 2% curve 2ms
   ❯ ladder-backward-face-construction — Level-real-income ladder: faces solved back to front (4)
     × prices each par rung at face, so total cost is 2100/11 0ms
 Test Files  1 failed (1)
      Tests  2 failed | 13 passed (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-annual-coupon-par-pricing — Synthetic TIPS rung: floored coupon and par-curve price > prices a $1,000 face, 2% coupon, 3-year rung at par on a flat 2% curve
AssertionError: expected 57.67766545295558 to be less than or equal to 1e-9
 ❯ src/ladder/ladderMath.evidence.test.ts:99:75
     97|       expect(rung.maturityOffset).toBe(maturityYears)
     98|       expect(Math.abs(rung.face - face)).toBeLessThanOrEqual(abs)
     99|       expect(Math.abs(rung.cost - (example.expected.rungCost as number…
       |                                                                           ^
    100|       expect(Math.abs(build.totalCost - (example.expected.rungCost as …
    101|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > prices each par rung at face, so total cost is 2100/11
AssertionError: expected 25.61983471075294 to be less than or equal to 1e-9
 ❯ src/ladder/ladderMath.evidence.test.ts:200:82
    198|
    199|     it('prices each par rung at face, so total cost is 2100/11', () =>…
    200|       expect(Math.abs(build.totalCost - (example.expected.totalCost as…
       |                                                                                  ^
    201|     })
    202|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

`git checkout -- packages/engine/src/ladder/ladderMath.ts`, then `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` exited 0, confirming no change to production code after the run.
