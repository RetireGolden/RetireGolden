# Mutation receipt: projection-summary-lifetime-taxes-and-penalties

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6905169c` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `85e2fdb8` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 6b4a9cfc..a3d00136 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -383,7 +383,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): Proje
   let taxes = 0
   let conversions = 0
   for (const y of result.years) {
-    taxes += y.tax + y.penalties
+    taxes += y.tax
     conversions += y.rothConversion
   }
   const endingByCategory = { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0 }
```

Sum taxes only, dropping the separate penalties channel.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed because the verification's fixes (N1 to N4) moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (23 tests | 1 failed) 24ms
   ❯ projection-summary-lifetime-taxes-and-penalties — Projection summary lifetime taxes and penalties (1)
     × sums tax and penalties across all three years to 31000.75 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-lifetime-taxes-and-penalties — Projection summary lifetime taxes and penalties > sums tax and penalties across all three years to 31000.75
AssertionError: lifetimeTaxesAndPenalties: actual 29500.25, worksheet 31000.75: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:791:9
    789|         withinTolerance(summary.lifetimeTaxesAndPenalties, expected, e…
    790|         `lifetimeTaxesAndPenalties: actual ${summary.lifetimeTaxesAndP…
    791|       ).toBe(true)
       |         ^
    792|       // The wrong readings: taxes only, and penalties in the final ye…
    793|       const taxOnly = rows.reduce((sum, row) => sum + row.tax, 0)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
