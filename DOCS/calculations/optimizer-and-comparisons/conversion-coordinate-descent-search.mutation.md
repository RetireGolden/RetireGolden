# Mutation receipt: conversion-coordinate-descent-search

Executed 2026-09-17 and re-executed with a different mutant 2026-09-18 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`), and re-executed 2026-09-27 against RetireGolden base `2c780ae5` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `e1709b0e` (branch `claude/solver-answers-unpriced-aca`, pull request #748) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/search.ts`

```diff
diff --git a/packages/engine/src/decisions/search.ts b/packages/engine/src/decisions/search.ts
index caceaa44..2b230305 100644
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

Re-executed 2026-09-26 on the pull-request branch after the #748 review fixes moved lines of the production file, so the capture, blob hashes and revert note are refreshed against this head. The baseline is green (search.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine5/packages/engine

 ❯ src/decisions/search.evidence.test.ts (1 test | 1 failed) 47ms
   ❯ conversion-coordinate-descent-search — Conversion coordinate descent search (1)
     × retains the coarse 10000 move then the fine 12500 conversion 46ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


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
```

## Revert

The original bytes of `packages/engine/src/decisions/search.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/search.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
