# Mutation receipt: spending-shape-comparison

Executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `cb98a3a1` (branch `claude/b2p1-slice2-display-math`, pull request #752) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/spendingShapes.ts`

```diff
diff --git a/packages/engine/src/decisions/spendingShapes.ts b/packages/engine/src/decisions/spendingShapes.ts
index 4870fd42..883ead81 100644
--- a/packages/engine/src/decisions/spendingShapes.ts
+++ b/packages/engine/src/decisions/spendingShapes.ts
@@ -96,5 +96,5 @@
     maxBaseAnnual: row.maxBaseAnnual,
     deltaVsFlatDollars:
-      row.shape === 'flat' || row.maxBaseAnnual === null || flat === null ? null : row.maxBaseAnnual - flat,
+      row.maxBaseAnnual === null || flat === null ? null : row.maxBaseAnnual - flat,
   }))
 }
```

Publishes a difference on the flat row itself (always 0), where the table shows a dash: the flat row compared with itself is not a figure the comparison publishes.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/spendingShapes.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after the review of pull request #752, which typed the comparison's shape list as the three shapes it solves (three lines added above the mutated code), so the hunk header, capture, blob hash and revert note are refreshed against this head. The baseline is green (spendingShapes.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/decisions/spendingShapes.evidence.test.ts (6 tests | 1 failed) 15ms
   ❯ spending-shape-comparison — Spending shapes compared with constant-real spending (6)
     × cases A to G: each difference is taken between the two published amounts (R5) 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/spendingShapes.evidence.test.ts > spending-shape-comparison — Spending shapes compared with constant-real spending > cases A to G: each difference is taken between the two published amounts (R5)
AssertionError: caseA flat row: expected +0 to be null

- Expected:
null

+ Received:
0

 ❯ src/decisions/spendingShapes.evidence.test.ts:77:64
     75|         const e = expected[key]!
     76|         const rows = spendingShapeRows(published(c.flat, 'smile', c.sh…
     77|         expect(rows[0]!.deltaVsFlatDollars, `${key} flat row`).toBeNul…
       |                                                                ^
     78|         expect(rows[1]!.maxBaseAnnual, key).toBe(e.maxBaseAnnual)
     79|         expect(rows[1]!.deltaVsFlatDollars, key).toBe(e.delta)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/spendingShapes.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/spendingShapes.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
