# Mutation receipt: conversion-coordinate-descent-search

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/search.ts`

```diff
diff --git a/packages/engine/src/decisions/search.ts b/packages/engine/src/decisions/search.ts
index 6347ebf7..c5019738 100644
--- a/packages/engine/src/decisions/search.ts
+++ b/packages/engine/src/decisions/search.ts
@@ -154,5 +154,5 @@ export function refineConversionSchedule(
     }
   }
 
-  return { bestConversions, bestEvaluation, improved, simulationCount, sweepCount }
+  return { bestConversions, bestEvaluation, improved: false, simulationCount, sweepCount }
 }
```

Discard the improvement indicator after the coordinate search finds the worksheet's beneficial 12500 conversion. This reports no improvement despite the oracle's strictly better score. The best-schedule assertions remain passing and the independently specified improved flag kills this mutation.

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

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/search.evidence.test.ts > conversion-coordinate-descent-search — Conversion coordinate descent search > retains the coarse 10000 move then the fine 12500 conversion
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/search.evidence.test.ts:44:31
     42|       expect(actual.bestConversions[0]!.year).toBe(2026)
     43|       expect(actual.bestConversions[0]!.amount).toBe(example.expected.…
     44|       expect(actual.improved).toBe(example.expected.improved)
       |                               ^
     45|     } finally {
     46|       spy.mockRestore()

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/decisions/search.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration: exit 0, all tests passed.
