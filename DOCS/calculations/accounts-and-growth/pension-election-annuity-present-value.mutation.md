# Mutation receipt: pension-election-annuity-present-value

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-27 against RetireGolden base `b6d48615` (branch `claude/decided-small-items`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `5e8ee528` (branch `claude/decided-small-items`; no pull request is open yet) in `packages/engine`.

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

Take the bracketing anchor's real yield without interpolating to the horizon — the worksheet's second wrong reading. The six-year point collapses onto the five-year 1.93% anchor of the official 2026-06-30 row (decision D-TREASURY), so `curveRatePct` is 3.93% instead of 3.995%, the published six-payment `presentValueAtCurveRate` is $63,049.24798059383 instead of $62,915.883021698835, and the explicit three-payment helper case is $33,345.38422861391 instead of $33,304.25282719482. The first two of those are the worksheet's own wrong-reading values, to the cent. (Until D-TREASURY the curve's 5-year anchor was 1.85%, and the same mutant gave 3.85%, $63,213.991361387314 and $33,396.12458885356.)

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/pensionElection.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 for decision D-TREASURY: the embedded Treasury row became the official 2026-06-30 row, which changed this receipt's evidence file, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (pensionElection.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/decisions/pensionElection.evidence.test.ts (3 tests | 3 failed) 14ms
   ❯ pension-election-annuity-present-value — Pension annuity present value at the curve-anchored discount rate (3)
     × anchors the discount rate at 3.995%: the six-year real yield plus plan inflation 12ms
     × values presentValueAtCurveRate at 62915.883021698835: six payments through the planning age 1ms
     × discounts the helper's three payments at that rate to 33304.25282719482 1ms

 Test Files  1 failed (1)
      Tests  3 failed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/pensionElection.evidence.test.ts > pension-election-annuity-present-value — Pension annuity present value at the curve-anchored discount rate > anchors the discount rate at 3.995%: the six-year real yield plus plan inflation
AssertionError: curveRatePct 3.9299999999999997 is not within {"abs":1e-9} of 3.995: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/pensionElection.evidence.test.ts:104:9
    102|         withinTolerance(curveRatePct, expected.curveRatePct!, rateTole…
    103|         `curveRatePct ${curveRatePct} is not within ${JSON.stringify(r…
    104|       ).toBe(true)
       |         ^
    105|       // ... and it is the interpolation the worksheet states, midway …
    106|       // the 5- and 7-year anchors, plus the plan's inflation.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/decisions/pensionElection.evidence.test.ts > pension-election-annuity-present-value — Pension annuity present value at the curve-anchored discount rate > values presentValueAtCurveRate at 62915.883021698835: six payments through the planning age
AssertionError: presentValueAtCurveRate 63049.24798059385 is not within {"abs":0.005} of 62915.883021698835: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/decisions/pensionElection.evidence.test.ts:82:9
     80|         withinTolerance(actual, target, example.tolerance),
     81|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     82|       ).toBe(true)
       |         ^
     83|     }
     84|
 ❯ src/decisions/pensionElection.evidence.test.ts:127:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/decisions/pensionElection.evidence.test.ts > pension-election-annuity-present-value — Pension annuity present value at the curve-anchored discount rate > discounts the helper's three payments at that rate to 33304.25282719482
AssertionError: three-payment pensionAnnuityPresentValue 33345.384228613926 is not within {"abs":0.005} of 33304.25282719482: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/decisions/pensionElection.evidence.test.ts:82:9
     80|         withinTolerance(actual, target, example.tolerance),
     81|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     82|       ).toBe(true)
       |         ^
     83|     }
     84|
 ❯ src/decisions/pensionElection.evidence.test.ts:171:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/pensionElection.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/pensionElection.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
