# Mutation receipt: conversion-schedule-total

Executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `a1fd6d59` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d33ac09` (branch `claude/b2p1-slice3-comparisons`, pull request #754) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/optimizePlan.ts`

```diff
diff --git a/packages/engine/src/projection/optimizePlan.ts b/packages/engine/src/projection/optimizePlan.ts
index 6e0569a5..b0930958 100644
--- a/packages/engine/src/projection/optimizePlan.ts
+++ b/packages/engine/src/projection/optimizePlan.ts
@@ -2237,7 +2237,6 @@ function scheduleWithConversions(schedule: OptimizedSchedule, conversions: { yea
   return {
     ...schedule,
     conversions,
-    conversionTotal: conversionScheduleTotal(conversions),
     schedule: schedule.schedule.map((year) => ({
       ...year,
       conversion: roundDollars(byYear.get(year.year) ?? 0),
```

Stop recomputing the total when a cleaned schedule is built, so it arrives through the raw schedule's spread, the worksheet's third wrong reading: case Z's cleaned schedule of 15,000 and 5,000 publishes the raw request's 30,000 instead of 20,000.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/optimizer.conversionTotal.evidence.test.ts
```

## Captured failing output

The PR #754 review fixes changed these production files (the dollar basis built once, typed comparison refusals, the start-year refusal, the engine's material-shortfall flag, the per-candidate stochastic refusal) and one evidence file, so the hunk headers, quoted lines and test counts are re-pointed. The baseline is green (optimizer.conversionTotal.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine11/packages/engine

 ❯ src/strategies/optimizer.conversionTotal.evidence.test.ts (6 tests | 1 failed) 64ms
   ❯ conversion-schedule-total — Conversion schedule total (6)
     × a cleaned schedule publishes its own total, not the raw schedule's carried through a spread 48ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/strategies/optimizer.conversionTotal.evidence.test.ts > conversion-schedule-total — Conversion schedule total > a cleaned schedule publishes its own total, not the raw schedule's carried through a spread
AssertionError: cleaned total: actual 30000, worksheet 20000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ same src/strategies/optimizer.conversionTotal.evidence.test.ts:138:113
    136|     const entries = (amounts: number[]) => amounts.map((amount, index)…
    137|     const same = (actual: number, want: number, label: string) =>
    138|       expect(withinTolerance(actual, want, example.tolerance), `${labe…
       |                                                                                                                 ^
    139|
    140|     it('cases U, W and X: the amounts added left to right from 0', () …
 ❯ src/strategies/optimizer.conversionTotal.evidence.test.ts:201:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/optimizePlan.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/optimizePlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
