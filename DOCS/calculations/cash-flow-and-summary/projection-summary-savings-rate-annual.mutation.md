# Mutation receipt: projection-summary-savings-rate-annual

Executed 2026-10-10 against RetireGolden base `43876e8d` (branch `claude/census-completion`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index f552286d4..d77fee951 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -501,5 +501,5 @@ export function summarizeProjection(
   // 1. Savings rates
   const savingsRates = result.years.map((y) => {
-    const savings = y.contributions + y.employerMatch + y.surplusInvested
+    const savings = y.contributions + y.surplusInvested
     const gross = y.incomes.total
     const ratePct = gross > 0 ? Math.max(0, Math.min(100, (savings / gross) * 100)) : 0
```

Leave the employer match out of savings, the worksheet's first wrong reading: 2026 publishes 16 instead of 20. The pre-retirement average's own evidence enters no match, so this record's evidence is the one that catches it.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.breakdowns.evidence.test.ts
```

## Captured failing output

First execution, 2026-10-10 (D-MCP-CENSUS-PIN). The baseline is green (compareSummary.breakdowns.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/compareSummary.breakdowns.evidence.test.ts (3 tests | 1 failed) 20ms
   ❯ projection-summary-savings-rate-annual — Savings rate by year (1)
     × publishes 20, 0, 25 and 100 for the four years, each with its year 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.breakdowns.evidence.test.ts > projection-summary-savings-rate-annual — Savings rate by year > publishes 20, 0, 25 and 100 for the four years, each with its year
AssertionError: 2026 ratePct: actual 16, worksheet 20: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.breakdowns.evidence.test.ts:374:11
    372|           withinTolerance(entry.ratePct, worksheet, example.tolerance),
    373|           `${entry.year} ratePct: actual ${entry.ratePct}, worksheet $…
    374|         ).toBe(true)
       |           ^
    375|       }
    376|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
