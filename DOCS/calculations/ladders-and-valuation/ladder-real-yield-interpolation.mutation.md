# Mutation receipt: ladder-real-yield-interpolation

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
@@ -43,7 +43,7 @@ export function realYieldAt(curve: RealYieldCurve, maturityYears: number): numbe
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

Re-executed 2026-09-27 after merging RetireGolden #751 into B2-P1 slice 2: the drift check #751 adds flagged this receipt against the slice's code (a hunk header naming a line the code has moved from, a context line the slice changed, a header naming no line, or a stated test count the slice's evidence file no longer has), so the diff header, capture, blob hash and revert note are refreshed against this head. The baseline is green (ladderMath.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/ladder/ladderMath.evidence.test.ts (15 tests | 2 failed) 7ms
   ❯ ladder-real-yield-interpolation — Par real yield at a maturity: linear interpolation with flat endpoints (3)
     × interpolates 2.4% at 7 years between (5y, 2%) and (10y, 3%) 4ms
   ❯ ladder-real-present-value — Real present value of a cash-flow stream on the TIPS curve (2)
     × discounts $100 at 2 years (interpolated 2%) plus $100 at 4 years (flat 3%) to $184.9655829154 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 13 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-real-yield-interpolation — Par real yield at a maturity: linear interpolation with flat endpoints > interpolates 2.4% at 7 years between (5y, 2%) and (10y, 3%)
AssertionError: interiorYieldPct 2 is not within {"abs":1e-12} of the worksheet's 2.4: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/ladderMath.evidence.test.ts:43:9
     41|         withinTolerance(yieldPct, expected, example.tolerance),
     42|         `interiorYieldPct ${yieldPct} is not within ${JSON.stringify(e…
     43|       ).toBe(true)
       |         ^
     44|     })
     45|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-real-present-value — Real present value of a cash-flow stream on the TIPS curve > discounts $100 at 2 years (interpolated 2%) plus $100 at 4 years (flat 3%) to $184.9655829154
AssertionError: realPresentValue 183.1082957049443 is not within {"abs":1e-9} of the worksheet's 184.9655829154: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/ladderMath.evidence.test.ts:178:9
    176|         withinTolerance(pv, expected, example.tolerance),
    177|         `realPresentValue ${pv} is not within ${JSON.stringify(example…
    178|       ).toBe(true)
       |         ^
    179|     })
    180|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/ladderMath.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
