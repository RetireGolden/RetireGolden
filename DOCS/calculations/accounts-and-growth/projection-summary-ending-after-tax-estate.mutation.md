# Mutation receipt: projection-summary-ending-after-tax-estate

Executed 2026-09-18 against RetireGolden base `74916a7e` (branch `claude/b1-p4-cards-slice-seven`) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index b2fd5c29..ee5d8eb2 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -358,7 +358,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): Proje
     // What heirs receive: net worth less heir tax and less any charitable
     // bequests (charity leaves the heirs' estate but is never taxed). With no
     // charity destination this equals net worth − heir tax, as before.
-    endingAfterTaxEstate: result.endingNetWorth - estateToCharity - heirTax,
+    endingAfterTaxEstate: result.endingNetWorth - heirTax,
     endingEstateHeirTax: heirTax,
     endingEstateToCharity: estateToCharity,
     estateBreakdown,
```

Ignore the charity carve-out when netting the estate.

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
   ❯ projection-summary-ending-after-tax-estate — Projection summary ending after tax estate (2)
     × nets 812345.67 of net worth of both the 25000.00 charity carve-out and the 73210.11 heir tax 5ms
   ❯ projection-summary-estate-heir-tax — Projection summary estate heir tax (1)
     × sums the resolved per-account heir tax to 61600.00 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 12 passed (14)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-ending-after-tax-estate — Projection summary ending after tax estate > nets 812345.67 of net worth of both the 25000.00 charity carve-out and the 73210.11 heir tax
AssertionError: endingAfterTaxEstate: actual 739135.56, worksheet 714135.56: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:560:9
    558|         withinTolerance(summary.endingAfterTaxEstate, expected, exampl…
    559|         `endingAfterTaxEstate: actual ${summary.endingAfterTaxEstate},…
    560|       ).toBe(true)
       |         ^
    561|     })
    562|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

`git checkout -- packages/engine/src/projection/compare.ts` restored the exact original bytes (compared byte for byte in the harness), and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file returned to its baseline state (exit 1): the only failure is the disclosed `projection-summary-estate-heir-tax` discrepancy, which fails on unmutated production because the worksheet and the engine disagree about whether the charity fraction reduces the heir-taxed base (worksheet 61,600.00, engine 56,320.00).
