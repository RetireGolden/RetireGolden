# Mutation receipt: scenario-lifetime-tax-and-penalties

Executed 2026-09-18 against RetireGolden base `74916a7e` (branch `claude/b1-p4-cards-slice-seven`) in `packages/engine`.

## Mutation applied to `packages/engine/src/scenarios/comparison.ts`

```diff
diff --git a/packages/engine/src/scenarios/comparison.ts b/packages/engine/src/scenarios/comparison.ts
index 52c98783..3a9a2e91 100644
--- a/packages/engine/src/scenarios/comparison.ts
+++ b/packages/engine/src/scenarios/comparison.ts
@@ -675,8 +675,8 @@ export function compareScenarioPlans(
       endingNetWorth: scalar(baselineSummary.endingNetWorth, proposalSummary.endingNetWorth),
       endingAfterTaxEstate: scalar(baselineSummary.endingAfterTaxEstate, proposalSummary.endingAfterTaxEstate),
       lifetimeTax: scalar(
-        sum(baselineResult.years, (y) => y.tax),
-        sum(proposalResult.years, (y) => y.tax),
+        sum(baselineResult.years, (y) => y.tax + y.penalties),
+        sum(proposalResult.years, (y) => y.tax + y.penalties),
       ),
       lifetimePenalties: scalar(
         sum(baselineResult.years, (y) => y.penalties),
```

Fold penalties into the tax channel for both scenario sides.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/scenarios/comparisonCells.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s7/packages/engine

 ❯ src/scenarios/comparisonCells.evidence.test.ts (4 tests | 1 failed) 71ms
   ❯ scenario-lifetime-tax-and-penalties — Scenario lifetime tax and penalties (1)
     × totals each side separately without mixing the tax and penalty channels 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/scenarios/comparisonCells.evidence.test.ts > scenario-lifetime-tax-and-penalties — Scenario lifetime tax and penalties > totals each side separately without mixing the tax and penalty channels
AssertionError: baseline lifetime tax: actual 31000, worksheet 29500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/scenarios/comparisonCells.evidence.test.ts:322:11
    320|           withinTolerance(tax.baseline, expected.baselineTax, example.…
    321|           `baseline lifetime tax: actual ${tax.baseline}, worksheet ${…
    322|         ).toBe(true)
       |           ^
    323|         expect(
    324|           withinTolerance(tax.proposal, expected.proposalTax, example.…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/scenarios/comparison.ts` restored the exact original bytes (compared byte for byte in the harness), and `git diff --quiet -- packages/engine/src/scenarios/comparison.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (exit 0).
