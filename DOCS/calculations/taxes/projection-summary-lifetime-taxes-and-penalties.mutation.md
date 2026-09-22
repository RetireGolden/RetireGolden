# Mutation receipt: projection-summary-lifetime-taxes-and-penalties

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 893060b3..02fd34d2 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -212,7 +212,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): Proje
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

The capture also carries this file's pre-existing `projection-summary-estate-heir-tax` failure (the engine's 56,320.00 against the worksheet's 61,600.00). That failure is present on unmutated production and is not caused by this mutation.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #727: the heir-tax fixture had grown to two cases since the first execution and the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (15 tests | 1 failed) 20ms
   ❯ projection-summary-lifetime-taxes-and-penalties — Projection summary lifetime taxes and penalties (1)
     × sums tax and penalties across all three years to 31000.75 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-lifetime-taxes-and-penalties — Projection summary lifetime taxes and penalties > sums tax and penalties across all three years to 31000.75
AssertionError: lifetimeTaxesAndPenalties: actual 29500.25, worksheet 31000.75: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:762:9
    760|         withinTolerance(summary.lifetimeTaxesAndPenalties, expected, e…
    761|         `lifetimeTaxesAndPenalties: actual ${summary.lifetimeTaxesAndP…
    762|       ).toBe(true)
       |         ^
    763|       // The wrong readings: taxes only, and penalties in the final ye…
    764|       const taxOnly = rows.reduce((sum, row) => sum + row.tax, 0)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
