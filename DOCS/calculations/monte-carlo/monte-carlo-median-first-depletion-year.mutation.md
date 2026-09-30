# Mutation receipt: monte-carlo-median-depletion-year

Executed 2026-09-30 against RetireGolden base `fbc9a9d3` (branch `claude/ui-relocations-six`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
diff --git a/packages/engine/src/montecarlo/run.ts b/packages/engine/src/montecarlo/run.ts
index 46dbbe431..9dcc0fafc 100644
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ -624,7 +624,7 @@ function medianFirstDepletionYear(
   let seen = 0
   for (const row of depletionYearCounts) {
     seen += row.count
-    if (seen >= failingPathCount / 2) return row.year
+    if (seen > failingPathCount / 2) return row.year
   }
   return null
 }
```

The upper middle year for an even failing count, the worksheet's second wrong reading: case B's four failing paths read 2045 where the worksheet expects the lower middle year, 2040. The odd cases do not move, since their running count passes half without equalling it.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.depletionMedian.evidence.test.ts
```

## Captured failing output

The baseline is green (run.depletionMedian.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/run.depletionMedian.evidence.test.ts (6 tests | 1 failed) 7ms
   ❯ monte-carlo-median-depletion-year — Median first-depletion year (6)
     × case B: with four failing paths the median is the lower middle year, 2040 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.depletionMedian.evidence.test.ts > monte-carlo-median-depletion-year — Median first-depletion year > case B: with four failing paths the median is the lower middle year, 2040
AssertionError: expected 2045 to be 2040 // Object.is equality

- Expected
+ Received

- 2040
+ 2045

 ❯ src/montecarlo/run.depletionMedian.evidence.test.ts:87:22
     85|     it('case B: with four failing paths the median is the lower middle…
     86|       const median = medianOf(inputs.caseB!)
     87|       expect(median).toBe(expected.caseB)
       |                      ^
     88|       expect(median).not.toBe(expected.wrongUpperMedianB)
     89|       expect(Number.isInteger(median)).toBe(true)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
