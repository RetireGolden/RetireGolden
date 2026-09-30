# Mutation receipt: mcp-batch-ending-traditional-objective

Executed 2026-09-30 on branch `claude/evidence-completeness` at RetireGolden base `f97cf418`, with this change's evidence test in the working tree (no pull request is open yet), in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index f552286d4..fc9f10167 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -402,7 +402,7 @@ export function summarizeProjection(
     const lastByCategory = balancesByCategory(plan, last)
     endingByCategory.cash = lastByCategory.cash
     endingByCategory.taxable = lastByCategory.taxable
-    endingByCategory.traditional = lastByCategory.traditional
+    endingByCategory.traditional = lastByCategory.traditional + lastByCategory.hsa
     endingByCategory.roth = lastByCategory.roth
     endingByCategory.hsa = lastByCategory.hsa
   }
```

Count the HSA with the traditional accounts, reading the objective as all pre-tax money (the worksheet's second wrong reading).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.mcpObjectives.evidence.test.ts
```

## Captured failing output

The baseline is green (compareSummary.mcpObjectives.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
 RUN  v5.0.0 packages/engine

 ❯ src/projection/compareSummary.mcpObjectives.evidence.test.ts (4 tests | 2 failed) 16ms
   ❯ mcp-batch-ending-traditional-objective — MCP batch ending traditional balance objective (2)
     × adds the last row of the IRA and the 401(k), 240,500.25 + 310,250.50 = 550,750.75, and nothing else 7ms
     × agrees with the pinned adapter's walk over the last row's balance entries within half a cent 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.mcpObjectives.evidence.test.ts > mcp-batch-ending-traditional-objective — MCP batch ending traditional balance objective > adds the last row of the IRA and the 401(k), 240,500.25 + 310,250.50 = 550,750.75, and nothing else
AssertionError: objective: actual 572750.75, worksheet 550750.75: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.mcpObjectives.evidence.test.ts:258:9
    256|         withinTolerance(objective, expected.objective!, example.tolera…
    257|         `objective: actual ${objective}, worksheet ${expected.objectiv…
    258|       ).toBe(true)
       |         ^
    259|       for (const reading of ['penultimateRow', 'hsaIncluded', 'rothInc…
    260|         expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/compareSummary.mcpObjectives.evidence.test.ts > mcp-batch-ending-traditional-objective — MCP batch ending traditional balance objective > agrees with the pinned adapter's walk over the last row's balance entries within half a cent
AssertionError: engine 572750.75, adapter 550750.75: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.mcpObjectives.evidence.test.ts:280:9
    278|         withinTolerance(summary.endingByCategory.traditional, adapter,…
    279|         `engine ${summary.endingByCategory.traditional}, adapter ${ada…
    280|       ).toBe(true)
       |         ^
    281|     })
    282|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
