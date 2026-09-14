# Mutation receipt: treasury-real-yield-curve-2026

Executed 2026-09-14 against RetireGolden head `efaeb827` (branch claude/b1-p4-cards-longevity) in `packages/engine`, with the PR #714 round-1 revision of `src/params/data/realYieldCurve2026.evidence.test.ts` applied: the fixture pins the worksheet's Expected section, the stored row, with a zero absolute bound. This run replaces the same-day run against base `319c16ca` (branch claude/b1-p4-cards-ladders), whose fixture compared at 1e-12.

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

This changes the stored 5-year point from 1.85 to the official 1.93, the kind of one-value edit a silent correction would make. The pin on the worksheet's stored row catches it: 1.93 is not exactly 1.85, so the zero-bound comparison fails, while the structure and limits assertions still pass. It is the 5-year point of the deviation the worksheet tabulates (stored minus official, -8bp), chosen so the receipt shows the pin moves the moment the stored data does.

## Command

```
npx vitest run src/params/data/realYieldCurve2026.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines and the `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4long/packages/engine
 ❯ src/params/data/realYieldCurve2026.evidence.test.ts (3 tests | 1 failed) 5ms
   ❯ treasury-real-yield-curve-2026 — Embedded Treasury par real-yield curve, 2026-06-30 (3)
     × carries the stored row 1.85/2.05/2.25/2.55/2.70 percent per year, exactly 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/params/data/realYieldCurve2026.evidence.test.ts > treasury-real-yield-curve-2026 — Embedded Treasury par real-yield curve, 2026-06-30 > carries the stored row 1.85/2.05/2.25/2.55/2.70 percent per year, exactly
AssertionError: realYieldPct at 5 years 1.93 is not exactly the worksheet's stored 1.85: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/params/data/realYieldCurve2026.evidence.test.ts:42:11
     40|           withinTolerance(point.realYieldPct, expectedYields[index]!, …
     41|           `realYieldPct at ${point.maturityYears} years ${point.realYi…
     42|         ).toBe(true)
       |           ^
     43|       })
     44|     })
 ❯ src/params/data/realYieldCurve2026.evidence.test.ts:38:36
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
```

## Revert

`git checkout -- packages/engine/src/params/data/realYieldCurve2026.ts`, then `git diff --quiet -- packages/engine/src/params/data/realYieldCurve2026.ts` exited 0, confirming no change to production code after the run.
