# Mutation receipt: optimizer-schedule-objective-and-lifetime-tax

First executed 2026-10-10 on the uncommitted work of branch `claude/census-optimizer-schedule` on RetireGolden `429bbca7` (RetireGolden#791's head `claude/census-completion`), before the slice was rebased onto main and squashed into RetireGolden#792. Re-executed 2026-10-10 on RetireGolden#792's branch after its first review pinned the library example's measured dollars in the evidence file, which moved the line numbers below; and re-executed again 2026-10-10 against RetireGolden `f2c5db07` (branch `claude/optimizer-solver-output`, decision D-OPTIMIZER-SOLVER-OUTPUT; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/optimizer.ts`

```diff
diff --git a/packages/engine/src/strategies/optimizer.ts b/packages/engine/src/strategies/optimizer.ts
index 9085d3e4b..c6772fe27 100644
--- a/packages/engine/src/strategies/optimizer.ts
+++ b/packages/engine/src/strategies/optimizer.ts
@@ -1113,7 +1113,7 @@ export function buildOptimizerModel(input: OptimizerInput): BuiltModel {
   const objTerms: Terms = {
     [`other${n}`]: deflate,
     [`trad${n}`]: deflate * (1 - liquidationRate),
-    [`inh${n}`]: deflate * (1 - liquidationRate),
+    [`inh${n}`]: deflate,
   }
   // Ending taxable counts at full value (heirs get a basis step-up; the exact
   // ledger prices the true estate treatment). Only present when split out.
```

Count the inherited traditional bucket in full in the objective, the worksheet's wrong reading: case 2 publishes `1,871,227.85 + 0.09756098 × 354,900 = 1,905,852.24` (before the record's restatement for D-OPTIMIZER-SOLVER-OUTPUT, `1,825,588.15 + 0.09518144 × 354,900 = 1,859,368.04`). The solution itself does not move (a dollar kept in the inherited bucket is still worth more than one drawn), so only the published objective is wrong; case 1 has no inherited balance, bracket-fill-roth none at the end, and cases 3 and 4 no solution, and all still pass.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/optimizer.schedule.evidence.test.ts
```

## Captured failing output

Re-executed for decision D-OPTIMIZER-SOLVER-OUTPUT, which restated this record (the engine reads HiGHS's raw solution in cents, deflates on the engine's basis, and publishes no figures or rows without a solution) and moved the lines this receipt quotes; the mutation is unchanged, and the diff's line numbers and blob hashes and the capture are refreshed against this head. The evidence file now registers eight tests (the year-solution record gained one, for cases 3 and 4). The baseline is green (optimizer.schedule.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
 RUN  v5.0.0 packages/engine

 ❯ src/strategies/optimizer.schedule.evidence.test.ts (8 tests | 1 failed) 1200ms
   ❯ optimizer-schedule-objective-and-lifetime-tax — Optimizer's own ending after-tax wealth and lifetime tax (5)
     × case 2 deflates over one year, haircuts the inherited bucket, and taxes the published income, tiers and gain: 1871227.85, tax 47663.94 23ms

 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/strategies/optimizer.schedule.evidence.test.ts > optimizer-schedule-objective-and-lifetime-tax — Optimizer's own ending after-tax wealth and lifetime tax > case 2 deflates over one year, haircuts the inherited bucket, and taxes the published income, tiers and gain: 1871227.85, tax 47663.94
AssertionError: endingAfterTax: actual 1905852.24, worksheet 1871227.85: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ same src/strategies/optimizer.schedule.evidence.test.ts:362:114
    360|       }
    361|       expect(actual, label).not.toBeNull()
    362|       expect(withinTolerance(actual!, want, example.tolerance), `${lab…
       |                                                                                                                  ^
    363|     }
    364|     async function expectTotals(inputs: CaseInputs, want: Totals): Pro…
 ❯ expectTotals src/strategies/optimizer.schedule.evidence.test.ts:367:7
 ❯ src/strategies/optimizer.schedule.evidence.test.ts:377:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/strategies/optimizer.ts` were written back from a copy taken before the mutation and compared byte for byte, and `git diff --quiet -- packages/engine/src/strategies/optimizer.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
