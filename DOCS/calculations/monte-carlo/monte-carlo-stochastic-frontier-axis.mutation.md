# Mutation receipt: monte-carlo-stochastic-frontier-axis

Executed 2026-09-18 against RetireGolden base `f12eba6d` (branch claude/b1-p4-cards-slice-ten) in `packages/engine`.

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

Executed 2026-09-18 by the orchestrator after the worksheet was re-derived on the corrected axis comment and the fixture followed it; the implementing session's writes to the production file had been refused by its permission classifier. The baseline is green (frontiers.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s10/packages/engine

 ❯ src/montecarlo/frontiers.evidence.test.ts (4 tests | 1 failed) 123ms
   ❯ monte-carlo-stochastic-frontier-axis — Stochastic frontier axis value per variant (4)
     × puts each spending variant's own base annual expense on the axis: 48,000, 60,000 and 72,000 70ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)


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

Not needed: no production file was modified. `git diff --quiet -- packages/engine/src/montecarlo/frontiers.ts` exits 0.
