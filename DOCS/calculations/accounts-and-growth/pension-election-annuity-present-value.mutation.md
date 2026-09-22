# Mutation receipt: pension-election-annuity-present-value

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/pensionElection.ts`

```diff
diff --git a/packages/engine/src/decisions/pensionElection.ts b/packages/engine/src/decisions/pensionElection.ts
index ff7cc63d..7e16581c 100644
--- a/packages/engine/src/decisions/pensionElection.ts
+++ b/packages/engine/src/decisions/pensionElection.ts
@@ -134,9 +134,7 @@ export function curveNominalDiscountRatePct(horizonYears: number, inflationPct:
       const a = points[i]!
       const b = points[i + 1]!
       if (horizonYears >= a.maturityYears && horizonYears <= b.maturityYears) {
-        real =
-          a.realYieldPct +
-          ((b.realYieldPct - a.realYieldPct) * (horizonYears - a.maturityYears)) / (b.maturityYears - a.maturityYears)
+        real = a.realYieldPct
         break
       }
     }
```

Take the bracketing anchor's real yield without interpolating to the horizon — the worksheet's second wrong reading. The six-year point collapses onto the five-year 1.85% anchor, so `curveRatePct` is 3.85% instead of 3.95%, the published six-payment `presentValueAtCurveRate` is $63,213.991361387314 instead of $63,008.166010097986, and the explicit three-payment helper case is $33,396.12458885356 instead of $33,332.7193407416. The first two of those are the worksheet's own wrong-reading values, to the cent.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/pensionElection.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (pensionElection.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/decisions/pensionElection.evidence.test.ts (3 tests | 3 failed) 22ms
   ❯ pension-election-annuity-present-value — Pension annuity present value at the curve-anchored discount rate (3)
     × anchors the discount rate at 3.95%: the six-year real yield plus plan inflation 19ms
     × values presentValueAtCurveRate at 63008.166010097986: six payments through the planning age 1ms
     × discounts the helper's three payments at that rate to 33332.7193407416 1ms

 Test Files  1 failed (1)
      Tests  3 failed (3)

  Transform  transforming modules took 2.42s · 45% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/pensionElection.evidence.test.ts > pension-election-annuity-present-value — Pension annuity present value at the curve-anchored discount rate > anchors the discount rate at 3.95%: the six-year real yield plus plan inflation
AssertionError: curveRatePct 3.85 is not within {"abs":1e-9} of 3.95: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/pensionElection.evidence.test.ts:102:9
    100|         withinTolerance(curveRatePct, expected.curveRatePct!, rateTole…
    101|         `curveRatePct ${curveRatePct} is not within ${JSON.stringify(r…
    102|       ).toBe(true)
       |         ^
    103|       // ... and it is the interpolation the worksheet states, midway …
    104|       // the 5- and 7-year anchors, plus the plan's inflation.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/decisions/pensionElection.evidence.test.ts > pension-election-annuity-present-value — Pension annuity present value at the curve-anchored discount rate > values presentValueAtCurveRate at 63008.166010097986: six payments through the planning age
AssertionError: presentValueAtCurveRate 63213.991361387314 is not within {"abs":0.005} of 63008.166010097986: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/decisions/pensionElection.evidence.test.ts:80:9
     78|         withinTolerance(actual, target, example.tolerance),
     79|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     80|       ).toBe(true)
       |         ^
     81|     }
     82|
 ❯ src/decisions/pensionElection.evidence.test.ts:121:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/decisions/pensionElection.evidence.test.ts > pension-election-annuity-present-value — Pension annuity present value at the curve-anchored discount rate > discounts the helper's three payments at that rate to 33332.7193407416
AssertionError: three-payment pensionAnnuityPresentValue 33396.12458885356 is not within {"abs":0.005} of 33332.7193407416: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/decisions/pensionElection.evidence.test.ts:80:9
     78|         withinTolerance(actual, target, example.tolerance),
     79|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     80|       ).toBe(true)
       |         ^
     81|     }
     82|
 ❯ src/decisions/pensionElection.evidence.test.ts:165:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/pensionElection.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/pensionElection.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
