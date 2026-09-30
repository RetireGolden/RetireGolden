# Mutation receipt: mcp-batch-cumulative-tax-objective

Executed 2026-09-30 on branch `claude/evidence-completeness` at RetireGolden base `f97cf418`, with this change's evidence test in the working tree (no pull request is open yet), in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index f552286d4..e388e22d0 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -391,7 +391,7 @@ export function summarizeProjection(
   let taxes = 0
   let conversions = 0
   for (const y of result.years) {
-    taxes += y.tax + y.penalties
+    taxes += y.tax
     conversions += y.rothConversion
   }
   const endingByCategory = { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0 }
```

Sum tax only, dropping the separate penalties channel (the worksheet's first wrong reading).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.mcpObjectives.evidence.test.ts
```

## Captured failing output

The baseline is green (compareSummary.mcpObjectives.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
 RUN  v5.0.0 packages/engine

 ❯ src/projection/compareSummary.mcpObjectives.evidence.test.ts (4 tests | 2 failed) 18ms
   ❯ mcp-batch-cumulative-tax-objective — MCP batch cumulative tax objective (2)
     × sums tax plus penalties over the four years to 67,191.52, penalties in, the AMT once and no IRMAA 12ms
     × agrees with the pinned adapter's own reduction, tax then penalties year by year, within half a cent 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.mcpObjectives.evidence.test.ts > mcp-batch-cumulative-tax-objective — MCP batch cumulative tax objective > sums tax plus penalties over the four years to 67,191.52, penalties in, the AMT once and no IRMAA
AssertionError: objective: actual 63691.17, worksheet 67191.52: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.mcpObjectives.evidence.test.ts:176:9
    174|         withinTolerance(summary.lifetimeTaxesAndPenalties, expected.ob…
    175|         `objective: actual ${summary.lifetimeTaxesAndPenalties}, works…
    176|       ).toBe(true)
       |         ^
    177|       // The worksheet's wrong readings, each a cent or more away.
    178|       for (const reading of ['taxOnly', 'amtCountedTwice', 'irmaaCount…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/compareSummary.mcpObjectives.evidence.test.ts > mcp-batch-cumulative-tax-objective — MCP batch cumulative tax objective > agrees with the pinned adapter's own reduction, tax then penalties year by year, within half a cent
AssertionError: engine 63691.17, adapter 67191.52: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.mcpObjectives.evidence.test.ts:194:9
    192|         withinTolerance(summary.lifetimeTaxesAndPenalties, adapter, ex…
    193|         `engine ${summary.lifetimeTaxesAndPenalties}, adapter ${adapte…
    194|       ).toBe(true)
       |         ^
    195|     })
    196|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
