# Mutation receipt: conversion-coordinate-descent-search

Executed 2026-09-17 and re-executed with a different mutant 2026-09-18 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/search.ts`

```diff
diff --git a/packages/engine/src/decisions/search.ts b/packages/engine/src/decisions/search.ts
index 6347ebf7..5275f577 100644
--- a/packages/engine/src/decisions/search.ts
+++ b/packages/engine/src/decisions/search.ts
@@ -120,7 +120,7 @@ export function refineConversionSchedule(
     .filter((year) => year > lastSeedYear)
     .slice(0, TAPER_EXTENSION_YEARS)
   const years = [...seedYears, ...extensionYears]
-  const steps = coarseStep === fineStep ? [coarseStep] : [coarseStep, fineStep]
+  const steps = [coarseStep]
 
   for (const step of steps) {
     for (let sweep = 0; sweep < maxSweepsPerStep; sweep++) {
```

Drop the fine step, so the search stops after the coarse $10,000 move and never tries the $12,500 refinement the worksheet's arithmetic names ($0 -> $10,000 -> $12,500). Re-executed 2026-09-18 in place of an earlier mutant that only hard-coded the improved flag: both of the worksheet's stated wrong readings (accept every nonnegative move; require an improvement of at least the coarse step) drive the search to a probe outside the worksheet's four-entry score table, where the fixture's guard throws before any assertion, so neither can be shown failing on the published value; the fine-step mutant can.

## Command

```
npx.cmd vitest run src/decisions/search.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/decisions/search.evidence.test.ts (1 test | 1 failed) 47ms
   ❯ conversion-coordinate-descent-search — Conversion coordinate descent search (1)
     × retains the coarse 10000 move then the fine 12500 conversion 46ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/search.evidence.test.ts > conversion-coordinate-descent-search — Conversion coordinate descent search > retains the coarse 10000 move then the fine 12500 conversion
AssertionError: expected 10000 to be 12500 // Object.is equality

- Expected
+ Received

- 12500
+ 10000

 ❯ src/decisions/search.evidence.test.ts:43:49
     41|       expect(actual.bestConversions.length).toBe(1)
     42|       expect(actual.bestConversions[0]!.year).toBe(2026)
     43|       expect(actual.bestConversions[0]!.amount).toBe(example.expected.…
       |                                                 ^
     44|       expect(actual.improved).toBe(example.expected.improved)
     45|     } finally {

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed (1)
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/decisions/search.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration: exit 0, all tests passed.
