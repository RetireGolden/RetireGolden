# Mutation receipt: optimizer-schedule-year-solution

First executed 2026-10-10 on the uncommitted work of branch `claude/census-optimizer-schedule` on RetireGolden `429bbca7` (RetireGolden#791's head `claude/census-completion`), before the slice was rebased onto main and squashed into RetireGolden#792. Re-executed 2026-10-10 on RetireGolden#792's branch after its first review pinned the library example's measured dollars in the evidence file, which moved the line numbers below, in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/optimizer.ts`

```diff
diff --git a/packages/engine/src/strategies/optimizer.ts b/packages/engine/src/strategies/optimizer.ts
index 4824e73be..c07bf3c99 100644
--- a/packages/engine/src/strategies/optimizer.ts
+++ b/packages/engine/src/strategies/optimizer.ts
@@ -1185,7 +1185,7 @@ export async function optimizeSchedule(input: OptimizerInput): Promise<Optimized
       endTrad: round(col(`trad${t + 1}`)),
       endInheritedTrad: round(col(`inh${t + 1}`)),
       endOther: round(col(`other${t + 1}`)),
-      endTaxable: round(col(`taxable${t + 1}`)),
+      endTaxable: round(col(`taxable${t}`)),
     })
   }
 
```

Publish the taxable bucket's opening balance as its year-end balance, the worksheet's wrong reading: case 1 publishes `endTaxable` 400,000 instead of 420,000, and case 2's 2026 row 400,000 instead of 357,793. The solution does not move; only the readout is wrong. bracket-fill-roth has no taxable bucket, so the library test of the other record still passes.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/optimizer.schedule.evidence.test.ts
```

## Captured failing output

Re-execution, 2026-10-10 (D-MCP-OPTIMIZER-SCHEDULE, RetireGolden#792's first review); the same tests fail with the same messages as at the first execution. The baseline is green (optimizer.schedule.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
 RUN  v5.0.0 packages/engine

 ❯ src/strategies/optimizer.schedule.evidence.test.ts (7 tests | 2 failed) 1260ms
   ❯ optimizer-schedule-year-solution — Optimizer's per-year solution (2)
     × case 1 converts through the 24% bracket, draws the floor and pays the tax from the tax-free bucket: conversion 107029 49ms
     × case 2 draws both floors, sells to fund 2026 and saves in 2027: sale 59245.2, tiers 2 and 1 44ms

 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/strategies/optimizer.schedule.evidence.test.ts > optimizer-schedule-year-solution — Optimizer's per-year solution > case 1 converts through the 24% bracket, draws the floor and pays the tax from the tax-free bucket: conversion 107029
AssertionError: 2026 endTaxable: actual 400000, worksheet 420000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectYears src/strategies/optimizer.schedule.evidence.test.ts:185:13
    183|             withinTolerance(row[column], want.values[column], example.…
    184|             `${want.year} ${column}: actual ${row[column]}, worksheet …
    185|           ).toBe(true)
       |             ^
    186|         }
    187|       }
 ❯ src/strategies/optimizer.schedule.evidence.test.ts:199:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/strategies/optimizer.schedule.evidence.test.ts > optimizer-schedule-year-solution — Optimizer's per-year solution > case 2 draws both floors, sells to fund 2026 and saves in 2027: sale 59245.2, tiers 2 and 1
AssertionError: 2026 endTaxable: actual 400000, worksheet 357793: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectYears src/strategies/optimizer.schedule.evidence.test.ts:185:13
    183|             withinTolerance(row[column], want.values[column], example.…
    184|             `${want.year} ${column}: actual ${row[column]}, worksheet …
    185|           ).toBe(true)
       |             ^
    186|         }
    187|       }
 ❯ src/strategies/optimizer.schedule.evidence.test.ts:205:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/strategies/optimizer.ts` were written back from a copy taken before the mutation and compared byte for byte, and `git diff --quiet -- packages/engine/src/strategies/optimizer.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
