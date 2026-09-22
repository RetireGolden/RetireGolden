# Mutation receipt: pension-election-annuity-present-value

Executed 2026-09-18 against RetireGolden base `1452ae11` (branch `claude/b1-p4-cards-slice-thirteen`) in `packages/engine`.

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

Re-executed 2026-09-18 against base `e522ddfb`, after the worksheet was re-derived (the published `presentValueAtCurveRate` runs through the planning age that also sets the curve horizon, six payments to $63,008.166010097986, and the three-payment stream became a second case stated explicitly at `pensionAnnuityPresentValue` with `ownerDeathAge` 67) and its fixture rebuilt around those values, dropping the test that pinned production's six-payment figure as a gap. The blob hashes in the diff above moved with the base; the mutated lines did not. The same mutation still fails, now on all three tests, because the rate it corrupts feeds every one of them. The baseline is green: `pensionElection.evidence.test.ts` passes on unmodified production, so no deliberately red test remains. Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and cache-hint lines were removed. Exit code: 1.

```

 RUN  v5.0.0 C:/TEMP/rg-s13/packages/engine

 ❯ src/decisions/pensionElection.evidence.test.ts (3 tests | 3 failed) 13ms
   ❯ pension-election-annuity-present-value — Pension annuity present value at the curve-anchored discount rate (3)
     × anchors the discount rate at 3.95%: the six-year real yield plus plan inflation 11ms
     × values presentValueAtCurveRate at 63008.166010097986: six payments through the planning age 1ms
     × discounts the helper's three payments at that rate to 33332.7193407416 1ms

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


 Test Files  1 failed (1)
      Tests  3 failed (3)
```

## Revert

`git checkout -- packages/engine/src/decisions/pensionElection.ts` restored the file, and `git diff --quiet -- packages/engine/src/decisions/pensionElection.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (3 passed, exit 0).
