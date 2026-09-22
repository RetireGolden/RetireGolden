# Mutation receipt: monte-carlo-depletion-distribution

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-ten` at base `f12eba6d`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ aggregateMonteCarlo, returned summary @@
-    depletionYearCounts,
+    depletionYearCounts: [{ year: null as unknown as number, count: successes }, ...depletionYearCounts],
```

Gives the successful paths a `null` bucket of their own — the worksheet's first wrong reading. It is written at the return site so `depletionProbabilityByYear`, which is derived earlier from the grouped rows, is left alone and only this record's block fails.

## Command

From `packages/engine` (the `npx` and `.cmd` shims do not work in this worktree):

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (run.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/montecarlo/run.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ monte-carlo-depletion-distribution — Depletion-year histogram across paths (1)
     × groups the two 2031 depletions and the 2033 depletion, leaving the two successes out 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)

  Transform  transforming modules took 2.14s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-depletion-distribution — Depletion-year histogram across paths > groups the two 2031 depletions and the 2033 depletion, leaving the two successes out
AssertionError: expected [ { year: null, count: 2 }, …(2) ] to deeply equal [ { year: 2031, count: 2 }, …(1) ]

- Expected
+ Received

@@ -1,8 +1,12 @@
  [
    {
      "count": 2,
+     "year": null,
+   },
+   {
+     "count": 2,
      "year": 2031,
    },
    {
      "count": 1,
      "year": 2033,

 ❯ src/montecarlo/run.evidence.test.ts:304:43
    302|     it('groups the two 2031 depletions and the 2033 depletion, leaving…
    303|       const summary = aggregateMonteCarlo(resultOf(startYear, endYear,…
    304|       expect(summary.depletionYearCounts).toEqual(example.expected.dep…
       |                                           ^
    305|     })
    306|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
