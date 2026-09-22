# Mutation receipt: projection-summary-coast-fire-number

Executed 2026-09-18 against RetireGolden base `74916a7e` (branch `claude/b1-p4-cards-slice-seven`) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index b2fd5c29..3ee19fa5 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -301,7 +301,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): Proje
   const startYear = result.startYear
   const inflationRate = plan.assumptions.inflationPct / 100
   const defaultReturn = plan.assumptions.defaultReturnPct / 100
-  const realReturn = defaultReturn - inflationRate
+  const realReturn = (1 + defaultReturn) / (1 + inflationRate) - 1

   const primary = plan.household.people[0]
   const birthYear = primary ? isoYear(primary.dob) : 1980
```

Use the Fisher real return instead of the stated simple subtraction.

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
   ❯ projection-summary-coast-fire-number — Projection summary coast fire number (2)
     × discounts the FI number four years at the simple real 4 percent 4ms
   ❯ projection-summary-estate-heir-tax — Projection summary estate heir tax (1)
     × sums the resolved per-account heir tax to 61600.00 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 12 passed (14)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-coast-fire-number — Projection summary coast fire number > discounts the FI number four years at the simple real 4 percent
AssertionError: coastFireNumber: actual 1754658.9877093076, worksheet 1746809.64013811: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:393:9
    391|         withinTolerance(summary.coastFireNumber, expected, example.tol…
    392|         `coastFireNumber: actual ${summary.coastFireNumber}, worksheet…
    393|       ).toBe(true)
       |         ^
    394|     })
    395|

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
