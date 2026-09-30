# Mutation receipt: ladder-annual-coupon-par-pricing

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
@@ -89,7 +89,7 @@ function priceRung(face: number, couponRatePct: number, maturityOffset: number,
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

Re-executed 2026-09-27 after merging RetireGolden #751 into B2-P1 slice 2: the drift check #751 adds flagged this receipt against the slice's code (a hunk header naming a line the code has moved from, a context line the slice changed, a header naming no line, or a stated test count the slice's evidence file no longer has), so the diff header, capture, blob hash and revert note are refreshed against this head. The baseline is green (ladderMath.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/ladder/ladderMath.evidence.test.ts (15 tests | 2 failed) 8ms
   ❯ ladder-annual-coupon-par-pricing — Synthetic TIPS rung: floored coupon and par-curve price (3)
     × prices a $1,000 face, 2% coupon, 3-year rung at par on a flat 2% curve 4ms
   ❯ ladder-backward-face-construction — Level-real-income ladder: faces solved back to front (4)
     × prices each par rung at face, so total cost is 2100/11 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 13 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-annual-coupon-par-pricing — Synthetic TIPS rung: floored coupon and par-curve price > prices a $1,000 face, 2% coupon, 3-year rung at par on a flat 2% curve
AssertionError: rung cost 942.3223345470444 is not within {"abs":1e-9} of the worksheet's 1000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/ladderMath.evidence.test.ts:120:9
    118|         withinTolerance(rung.cost, expectedCost, example.tolerance),
    119|         `rung cost ${rung.cost} is not within ${JSON.stringify(example…
    120|       ).toBe(true)
       |         ^
    121|       expect(
    122|         withinTolerance(build.totalCost, expectedCost, example.toleran…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > prices each par rung at face, so total cost is 2100/11
AssertionError: totalCost 165.28925619834706 is not within {"abs":1e-9} of the worksheet's 190.9090909091: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/ladderMath.evidence.test.ts:241:9
    239|         withinTolerance(build.totalCost, expected, example.tolerance),
    240|         `totalCost ${build.totalCost} is not within ${JSON.stringify(e…
    241|       ).toBe(true)
       |         ^
    242|     })
    243|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/ladderMath.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
