# Mutation receipt: treasury-real-yield-curve-2026

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders) in `packages/engine`.

## Mutation applied to `packages/engine/src/params/data/realYieldCurve2026.ts`

```diff
@@ -20,7 +20,7 @@ export const REAL_YIELD_CURVE_2026: RealYieldCurve = {
   asOfIso: '2026-06-30',
   source: 'U.S. Treasury Daily Par Real Yield Curve Rates',
   points: [
-    { maturityYears: 5, realYieldPct: 1.85 },
+    { maturityYears: 5, realYieldPct: 1.93 },
     { maturityYears: 7, realYieldPct: 2.05 },
     { maturityYears: 10, realYieldPct: 2.25 },
     { maturityYears: 20, realYieldPct: 2.55 },
```

This changes the embedded 5-year point from 1.85 to the official 1.93, the kind of one-value edit a silent correction would make. The pin on the documented embedded row catches it with a 0.08 miss against the 1e-12 tolerance; the structure and limits assertions still pass. It is the 5-year point of the discrepancy the record's limits state, chosen so the receipt shows the pin moves the moment the embedded data does.

## Command

```
npx vitest run src/params/data/realYieldCurve2026.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4impl/packages/engine
 ❯ src/params/data/realYieldCurve2026.evidence.test.ts (3 tests | 1 failed) 4ms
   ❯ treasury-real-yield-curve-2026 — Embedded Treasury par real-yield curve, 2026-06-30 (3)
     × carries the documented embedded yields 1.85/2.05/2.25/2.55/2.70 percent per year 2ms
 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/params/data/realYieldCurve2026.evidence.test.ts > treasury-real-yield-curve-2026 — Embedded Treasury par real-yield curve, 2026-06-30 > carries the documented embedded yields 1.85/2.05/2.25/2.55/2.70 percent per year
AssertionError: expected 0.07999999999999985 to be less than or equal to 1e-12
 ❯ src/params/data/realYieldCurve2026.evidence.test.ts:34:71
     32|       expect(REAL_YIELD_CURVE_2026.points).toHaveLength(expectedYields…
     33|       REAL_YIELD_CURVE_2026.points.forEach((point, index) => {
     34|         expect(Math.abs(point.realYieldPct - expectedYields[index]!)).…
       |                                                                       ^
     35|       })
     36|     })
 ❯ src/params/data/realYieldCurve2026.evidence.test.ts:33:36
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/params/data/realYieldCurve2026.ts`, then `git diff --quiet -- packages/engine/src/params/data/realYieldCurve2026.ts` exited 0, confirming no change to production code after the run.
