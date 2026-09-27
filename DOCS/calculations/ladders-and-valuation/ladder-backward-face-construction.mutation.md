# Mutation receipt: ladder-backward-face-construction

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
@@ -122,7 +122,7 @@ export function buildLadder(input: LadderBuildInput): LadderBuild {
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

Re-executed 2026-09-27 after merging RetireGolden #751 into B2-P1 slice 2: the drift check #751 adds flagged this receipt against the slice's code (a hunk header naming a line the code has moved from, a context line the slice changed, a header naming no line, or a stated test count the slice's evidence file no longer has), so the diff header, capture, blob hash and revert note are refreshed against this head. The baseline is green (ladderMath.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/ladder/ladderMath.evidence.test.ts (15 tests | 5 failed) 9ms
   ❯ ladder-annual-coupon-par-pricing — Synthetic TIPS rung: floored coupon and par-curve price (3)
     × prices a $1,000 face, 2% coupon, 3-year rung at par on a flat 2% curve 4ms
   ❯ ladder-backward-face-construction — Level-real-income ladder: faces solved back to front (4)
     × solves faces [1000/11, 100] back to front on a flat 10% curve 1ms
     × pays the level $110 target in both years and echoes the target 0ms
     × prices each par rung at face, so total cost is 2100/11 0ms
     × year 1 receipt is 1.1·F1 + 0.1·F2 from the returned faces 0ms

 Test Files  1 failed (1)
      Tests  5 failed | 10 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-annual-coupon-par-pricing — Synthetic TIPS rung: floored coupon and par-curve price > prices a $1,000 face, 2% coupon, 3-year rung at par on a flat 2% curve
AssertionError: rung face 1020 is not within {"abs":1e-9} of the worksheet's 1000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/ladderMath.evidence.test.ts:116:9
    114|         withinTolerance(rung.face, face, example.tolerance),
    115|         `rung face ${rung.face} is not within ${JSON.stringify(example…
    116|       ).toBe(true)
       |         ^
    117|       expect(
    118|         withinTolerance(rung.cost, expectedCost, example.tolerance),

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > solves faces [1000/11, 100] back to front on a flat 10% curve
AssertionError: face[0] 110 is not within {"abs":1e-9} of the worksheet's 90.9090909091: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/ladderMath.evidence.test.ts:220:11
    218|           withinTolerance(rung.face, expectedFaces[index]!, example.to…
    219|           `face[${index}] ${rung.face} is not within ${JSON.stringify(…
    220|         ).toBe(true)
       |           ^
    221|       })
    222|     })
 ❯ src/ladder/ladderMath.evidence.test.ts:216:19

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > pays the level $110 target in both years and echoes the target
AssertionError: annualRealIncomeByOffset[0] 132 is not within {"abs":1e-9} of the worksheet's 110: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/ladderMath.evidence.test.ts:231:11
    229|           withinTolerance(income, expectedIncome[index]!, example.tole…
    230|           `annualRealIncomeByOffset[${index}] ${income} is not within …
    231|         ).toBe(true)
       |           ^
    232|       })
    233|       expect(build.targetAnnualRealIncome).toBe(example.expected.targe…
 ❯ src/ladder/ladderMath.evidence.test.ts:227:38

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > prices each par rung at face, so total cost is 2100/11
AssertionError: totalCost 219.99999999999997 is not within {"abs":1e-9} of the worksheet's 190.9090909091: expected false to be true // Object.is equality

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/ladder/ladderMath.evidence.test.ts > ladder-backward-face-construction — Level-real-income ladder: faces solved back to front > year 1 receipt is 1.1·F1 + 0.1·F2 from the returned faces
AssertionError: year-1 receipt 132 is not within {"abs":1e-9} of the worksheet's 110: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/ladderMath.evidence.test.ts:253:9
    251|         withinTolerance(receipt, target, example.tolerance),
    252|         `year-1 receipt ${receipt} is not within ${JSON.stringify(exam…
    253|       ).toBe(true)
       |         ^
    254|     })
    255|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/ladderMath.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
