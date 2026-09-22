# Mutation receipt: monte-carlo-stochastic-frontier-axis

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-ten` at base `f12eba6d`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/frontiers.ts`

```diff
--- a/packages/engine/src/montecarlo/frontiers.ts
+++ b/packages/engine/src/montecarlo/frontiers.ts
@@ buildSpendingSuccessFrontier @@
-  return comparison.rows.map((row, index) => pointFromRow(row.id, row.label, variants[index]!.plan.expenses.baseAnnual, row))
+  return comparison.rows.map((row, index) => pointFromRow(row.id, row.label, multipliers[index]!, row))
```

Publishes the caller's spending multipliers as the axis instead of the variant plan's `expenses.baseAnnual` — the worksheet's first wrong reading.

## Command

From `packages/engine` (the `npx` and `.cmd` shims do not work in this worktree):

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/frontiers.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (frontiers.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/montecarlo/frontiers.evidence.test.ts (4 tests | 1 failed) 129ms
   ❯ monte-carlo-stochastic-frontier-axis — Stochastic frontier axis value per variant (4)
     × puts each spending variant's own base annual expense on the axis: 48,000, 60,000 and 72,000 78ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

  Transform  transforming modules took 2.12s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/frontiers.evidence.test.ts > monte-carlo-stochastic-frontier-axis — Stochastic frontier axis value per variant > puts each spending variant's own base annual expense on the axis: 48,000, 60,000 and 72,000
AssertionError: expected [ 0.8, 1, 1.2 ] to deeply equal [ 48000, 60000, 72000 ]

- Expected
+ Received

  [
-   48000,
-   60000,
-   72000,
+   0.8,
+   1,
+   1.2,
  ]

 ❯ src/montecarlo/frontiers.evidence.test.ts:93:46
     91|     it('puts each spending variant\'s own base annual expense on the a…
     92|       const points = buildSpendingSuccessFrontier(basePlan(baseAnnual)…
     93|       expect(points.map((point) => point.x)).toEqual(example.expected.…
       |                                              ^
     94|     })
     95|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/frontiers.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/frontiers.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
