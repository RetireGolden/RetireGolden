# Mutation receipt: mcp-compare-ending-after-tax-estate-delta

Executed 2026-09-30 on branch `claude/evidence-completeness` at RetireGolden base `f97cf418`, with this change's evidence test in the working tree (no pull request is open yet), in `packages/engine`.

The cell this mutation swaps is the one RetireGolden-MCP's `compare_scenarios` publishes as `deltaEndingAfterTaxEstateNominal`, named `deltaEndingAfterTaxEstate` through 0.11.x with the same value. The record and its worksheet were restated on 2026-10-09 by claude for RetireGolden-MCP 0.12.0 (`b2c7f717`): the field's new name, the `headline` it publishes beside the field (the Compare page's comparison, in today's dollars when the plans end in different years), and the different-years limit, which still applies to the renamed field. The engine cell, the evidence test and this capture did not change, so the receipt stands as executed.

## Mutation applied to `packages/engine/src/scenarios/comparison.ts`

```diff
diff --git a/packages/engine/src/scenarios/comparison.ts b/packages/engine/src/scenarios/comparison.ts
index d5e74bef1..ea29b2e2e 100644
--- a/packages/engine/src/scenarios/comparison.ts
+++ b/packages/engine/src/scenarios/comparison.ts
@@ -713,7 +713,7 @@ export function compareScenarioPlans(
     headline: {
       endingInvestable: compareScalars(baselineSummary.endingInvestable, proposalSummary.endingInvestable),
       endingNetWorth: compareScalars(baselineSummary.endingNetWorth, proposalSummary.endingNetWorth),
-      endingAfterTaxEstate: compareScalars(baselineSummary.endingAfterTaxEstate, proposalSummary.endingAfterTaxEstate),
+      endingAfterTaxEstate: compareScalars(proposalSummary.endingAfterTaxEstate, baselineSummary.endingAfterTaxEstate),
       lifetimeTax: compareScalars(
         sum(baselineResult.years, (y) => y.tax),
         sum(proposalResult.years, (y) => y.tax),
```

Swap the two plans, so the headline estate cell reads Plan A minus Plan B (the worksheet's first wrong reading).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/scenarios/comparison.mcpDelta.evidence.test.ts
```

## Captured failing output

The baseline is green (comparison.mcpDelta.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
 RUN  v5.0.0 packages/engine

 ❯ src/scenarios/comparison.mcpDelta.evidence.test.ts (2 tests | 2 failed) 88ms
   ❯ mcp-compare-ending-after-tax-estate-delta — MCP scenario ending after-tax estate delta (2)
     × reports Plan B minus Plan A, 2,000,000 in 2054 less 1,800,000 in 2050 = +200,000 nominal 56ms
     × equals the pinned adapter's subtraction of two independent summaries, each plan on its own calculator 31ms

 Test Files  1 failed (1)
      Tests  2 failed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/scenarios/comparison.mcpDelta.evidence.test.ts > mcp-compare-ending-after-tax-estate-delta — MCP scenario ending after-tax estate delta > reports Plan B minus Plan A, 2,000,000 in 2054 less 1,800,000 in 2050 = +200,000 nominal
AssertionError: baseline estate: actual 2000000, worksheet 1800000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/scenarios/comparison.mcpDelta.evidence.test.ts:96:9
     94|         withinTolerance(cell.baseline, expected.baselineEstate!, examp…
     95|         `baseline estate: actual ${cell.baseline}, worksheet ${expecte…
     96|       ).toBe(true)
       |         ^
     97|       expect(
     98|         withinTolerance(cell.proposal, expected.proposalEstate!, examp…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/scenarios/comparison.mcpDelta.evidence.test.ts > mcp-compare-ending-after-tax-estate-delta — MCP scenario ending after-tax estate delta > equals the pinned adapter's subtraction of two independent summaries, each plan on its own calculator
AssertionError: expected -200000 to be 200000 // Object.is equality

- Expected
+ Received

- 200000
+ -200000

 ❯ src/scenarios/comparison.mcpDelta.evidence.test.ts:126:89
    124|       const adapter = sb.endingAfterTaxEstate - sa.endingAfterTaxEstate
    125|       expect(withinTolerance(adapter, expected.delta!, example.toleran…
    126|       expect(compareScenarioPlans(a, b, options()).headline.endingAfte…
       |                                                                                         ^
    127|       // The two plans really end in the worksheet's two different yea…
    128|       expect(compareScenarioPlans(a, b, options()).headline.projection…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/scenarios/comparison.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/scenarios/comparison.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
