# Mutation receipt: ladder-real-present-value

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
@@ -201,7 +201,7 @@ export function realPresentValue(flows: Array<{ yearsFromNow: number; realAmount
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

Re-executed 2026-09-27 after merging RetireGolden #751 into B2-P1 slice 2: the drift check #751 adds flagged this receipt against the slice's code (a hunk header naming a line the code has moved from, a context line the slice changed, a header naming no line, or a stated test count the slice's evidence file no longer has), so the diff header, capture, blob hash and revert note are refreshed against this head. The baseline is green (ladderMath.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/ladder/ladderMath.evidence.test.ts (15 tests | 1 failed) 7ms
   ❯ ladder-real-present-value — Real present value of a cash-flow stream on the TIPS curve (2)
     × discounts $100 at 2 years (interpolated 2%) plus $100 at 4 years (flat 3%) to $184.9655829154 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/ladderMath.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
