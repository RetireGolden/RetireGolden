# Mutation receipt: optimizer-schedule-year-solution

First executed 2026-10-10 on the uncommitted work of branch `claude/census-optimizer-schedule` on RetireGolden `429bbca7` (RetireGolden#791's head `claude/census-completion`), before the slice was rebased onto main and squashed into RetireGolden#792. Re-executed 2026-10-10 on RetireGolden#792's branch after its first review pinned the library example's measured dollars in the evidence file, which moved the line numbers below; and re-executed again 2026-10-10 against RetireGolden `f2c5db07` (branch `claude/optimizer-solver-output`, decision D-OPTIMIZER-SOLVER-OUTPUT; no pull request is open yet) in `packages/engine`. Re-executed once more 2026-10-10 against the code of RetireGolden `440d37f4` (RetireGolden#793), after its first review moved the lines below; the mutation is unchanged. Re-executed 2026-10-24 against RetireGolden#822 (highs 1.15.4's persistent model API), whose reader rewrite moved the lines below; the mutation is unchanged.

## Mutation applied to `packages/engine/src/strategies/optimizer.ts`

```diff
diff --git a/packages/engine/src/strategies/optimizer.ts b/packages/engine/src/strategies/optimizer.ts
index ade8d57f3..7756e98f5 100644
--- a/packages/engine/src/strategies/optimizer.ts
+++ b/packages/engine/src/strategies/optimizer.ts
@@ -1495,7 +1495,7 @@ export async function optimizeSchedule(input: OptimizerInput): Promise<Optimized
       endTrad: round(col(`trad${t + 1}`)),
       endInheritedTrad: round(col(`inh${t + 1}`)),
       endOther: round(col(`other${t + 1}`)),
-      endTaxable: round(col(`taxable${t + 1}`)),
+      endTaxable: round(col(`taxable${t}`)),
     })
   }
 
```

Publish the taxable bucket's opening balance as its year-end balance, the worksheet's wrong reading: case 1 publishes `endTaxable` 400,000 instead of 420,000, and case 2's 2026 row 400,000 instead of 357,792.56 (357,793 before the record's restatement for D-OPTIMIZER-SOLVER-OUTPUT, read to six significant digits). The solution does not move; only the readout is wrong. bracket-fill-roth has no taxable bucket, so the library test of the other record still passes, and cases 3 and 4 have no solution and publish no rows, so their test passes too.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/optimizer.schedule.evidence.test.ts
```

## Captured failing output

Re-executed 2026-10-24 on branch `claude/project-thread-rlmoju` (RetireGolden#822), which moves the engine to highs 1.15.4's persistent model API: the reader now takes HiGHS's status codes and solution doubles from the model itself rather than a printed solution, which moved the lines this receipt quotes. The mutation is unchanged, and the diff's line numbers and blob hashes and the capture are refreshed against that code. The baseline is green (optimizer.schedule.evidence.test.ts passes on unmodified production, exit 0), and the mutant fails the same tests with the same figures as before. Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
 RUN  v5.0.5 packages/engine

 ❯ src/strategies/optimizer.schedule.evidence.test.ts (8 tests | 2 failed) 2627ms
   ❯ optimizer-schedule-year-solution — Optimizer's per-year solution (3)
     × case 1 converts through the 24% bracket, draws the floor and pays the tax from the tax-free bucket: conversion 107028.88 98ms
     × case 2 draws both floors, sells to fund 2026 and saves in 2027: sale 59245.18, tiers 2 and 1 73ms

 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/strategies/optimizer.schedule.evidence.test.ts > optimizer-schedule-year-solution — Optimizer's per-year solution > case 1 converts through the 24% bracket, draws the floor and pays the tax from the tax-free bucket: conversion 107028.88
AssertionError: 2026 endTaxable: actual 400000, worksheet 420000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectYears src/strategies/optimizer.schedule.evidence.test.ts:199:13
    197|             withinTolerance(row[column], want.values[column], example.…
    198|             `${want.year} ${column}: actual ${row[column]}, worksheet …
    199|           ).toBe(true)
       |             ^
    200|         }
    201|       }
 ❯ src/strategies/optimizer.schedule.evidence.test.ts:213:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/strategies/optimizer.schedule.evidence.test.ts > optimizer-schedule-year-solution — Optimizer's per-year solution > case 2 draws both floors, sells to fund 2026 and saves in 2027: sale 59245.18, tiers 2 and 1
AssertionError: 2026 endTaxable: actual 400000, worksheet 357792.56: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectYears src/strategies/optimizer.schedule.evidence.test.ts:199:13
    197|             withinTolerance(row[column], want.values[column], example.…
    198|             `${want.year} ${column}: actual ${row[column]}, worksheet …
    199|           ).toBe(true)
       |             ^
    200|         }
    201|       }
 ❯ src/strategies/optimizer.schedule.evidence.test.ts:219:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/strategies/optimizer.ts` were written back from a copy taken before the mutation and compared byte for byte, and `git diff --quiet -- packages/engine/src/strategies/optimizer.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
