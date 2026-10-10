# Mutation receipt: optimizer-schedule-objective-and-lifetime-tax

Executed 2026-10-10 against RetireGolden `429bbca7` (branch `claude/census-optimizer-schedule`, on RetireGolden#791's head `claude/census-completion`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/optimizer.ts`

```diff
diff --git a/packages/engine/src/strategies/optimizer.ts b/packages/engine/src/strategies/optimizer.ts
index 4824e73be..27d80c3cb 100644
--- a/packages/engine/src/strategies/optimizer.ts
+++ b/packages/engine/src/strategies/optimizer.ts
@@ -1028,7 +1028,7 @@ export function buildOptimizerModel(input: OptimizerInput): BuiltModel {
   const objTerms: Terms = {
     [`other${n}`]: deflate,
     [`trad${n}`]: deflate * (1 - liquidationRate),
-    [`inh${n}`]: deflate * (1 - liquidationRate),
+    [`inh${n}`]: deflate,
   }
   // Ending taxable counts at full value (heirs get a basis step-up; the exact
   // ledger prices the true estate treatment). Only present when split out.
```

Count the inherited traditional bucket in full in the objective, the worksheet's wrong reading: case 2 publishes `1,825,588.15 + 0.09518144 × 354,900 = 1,859,368.04`. The solution itself does not move (a dollar kept in the inherited bucket is still worth more than one drawn), so only the published objective is wrong; case 1 has no inherited balance and bracket-fill-roth none at the end, and both still pass.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/optimizer.schedule.evidence.test.ts
```

## Captured failing output

First execution, 2026-10-10 (D-MCP-OPTIMIZER-SCHEDULE). The baseline is green (optimizer.schedule.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
 RUN  v5.0.0 packages/engine

 ❯ src/strategies/optimizer.schedule.evidence.test.ts (7 tests | 1 failed) 1233ms
   ❯ optimizer-schedule-objective-and-lifetime-tax — Optimizer's own ending after-tax wealth and lifetime tax (5)
     × case 2 deflates over two years, haircuts the inherited bucket, and taxes the published income, tiers and gain: 1825588.15, tax 47664.03 30ms

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/strategies/optimizer.schedule.evidence.test.ts > optimizer-schedule-objective-and-lifetime-tax — Optimizer's own ending after-tax wealth and lifetime tax > case 2 deflates over two years, haircuts the inherited bucket, and taxes the published income, tiers and gain: 1825588.15, tax 47664.03
AssertionError: endingAfterTax: actual 1859368.04, worksheet 1825588.15: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectTotals src/strategies/optimizer.schedule.evidence.test.ts:323:9
    321|         withinTolerance(schedule.endingAfterTax, want.endingAfterTax, …
    322|         `endingAfterTax: actual ${schedule.endingAfterTax}, worksheet …
    323|       ).toBe(true)
       |         ^
    324|       expect(
    325|         withinTolerance(schedule.lifetimeTax, want.lifetimeTax, exampl…
 ❯ src/strategies/optimizer.schedule.evidence.test.ts:335:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/strategies/optimizer.ts` were written back from a copy taken before the mutation and compared byte for byte, and `git diff --quiet -- packages/engine/src/strategies/optimizer.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
