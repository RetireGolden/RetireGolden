# Mutation receipt: projection-summary-lifetime-taxes-and-penalties

Executed 2026-09-18 against RetireGolden base `74916a7e` (branch `claude/b1-p4-cards-slice-seven`) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index b2fd5c29..4f749380 100644
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

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s7/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (14 tests | 2 failed) 18ms
   ❯ projection-summary-estate-heir-tax — Projection summary estate heir tax (1)
     × sums the resolved per-account heir tax to 61600.00 5ms
   ❯ projection-summary-lifetime-taxes-and-penalties — Projection summary lifetime taxes and penalties (1)
     × sums tax and penalties across all three years to 31000.75 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 12 passed (14)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-estate-heir-tax — Projection summary estate heir tax > sums the resolved per-account heir tax to 61600.00
AssertionError: endingEstateHeirTax: actual 56320, worksheet 61600 (per-account actual traditional=47520, hsa=8800, roth=0): expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:697:9
    695|         `endingEstateHeirTax: actual ${summary.endingEstateHeirTax}, w…
    696|           `(per-account actual ${summary.estateBreakdown.map((row) => …
    697|       ).toBe(true)
       |         ^
    698|     })
    699|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-lifetime-taxes-and-penalties — Projection summary lifetime taxes and penalties > sums tax and penalties across all three years to 31000.75
AssertionError: lifetimeTaxesAndPenalties: actual 29500.25, worksheet 31000.75: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:735:9
    733|         withinTolerance(summary.lifetimeTaxesAndPenalties, expected, e…
    734|         `lifetimeTaxesAndPenalties: actual ${summary.lifetimeTaxesAndP…
    735|       ).toBe(true)
       |         ^
    736|       // The wrong readings: taxes only, and penalties in the final ye…
    737|       const taxOnly = rows.reduce((sum, row) => sum + row.tax, 0)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

`git checkout -- packages/engine/src/projection/compare.ts` restored the exact original bytes (compared byte for byte in the harness), and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file returned to its baseline state (exit 1): the only failure is the disclosed `projection-summary-estate-heir-tax` discrepancy, which fails on unmutated production because the worksheet and the engine disagree about whether the charity fraction reduces the heir-taxed base (worksheet 61,600.00, engine 56,320.00).
