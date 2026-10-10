# Mutation receipt: sustainable-spending-bisection

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`), and re-executed 2026-09-26 against RetireGolden base `6f58be5f` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `5d3a72b1` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c780ae5` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `e1709b0e` (branch `claude/solver-answers-unpriced-aca`, pull request #748), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-10-10 against RetireGolden base `43876e8d` (branch `claude/census-completion`; no pull request is open yet) in `packages/engine`.

Re-executed 2026-09-18 after the worksheet extension.

## Mutation applied to `packages/engine/src/decisions/spendingSolver.ts`

```diff
diff --git a/packages/engine/src/decisions/spendingSolver.ts b/packages/engine/src/decisions/spendingSolver.ts
index 6d174d4d8..16db13a59 100644
--- a/packages/engine/src/decisions/spendingSolver.ts
+++ b/packages/engine/src/decisions/spendingSolver.ts
@@ -421,5 +421,5 @@ export function solveMaxSustainableSpending(
     // The published amount (R4): the passing probe rounded down to a whole
     // $100 whenever that level is known to pass, else the probe itself.
-    const feasibleBaseAnnual = bestFeasible?.amount ?? null
+    const feasibleBaseAnnual = upper
     let maxBaseAnnual: number | null = null
     let maxBaseAnnualRounding: SustainableSpendingResult['maxBaseAnnualRounding'] = null
```

Publish the infeasible upper bound instead of the last feasible lower bound, the worksheet's first wrong reading, on the line that holds feasibleBaseAnnual (B2-P1 slice 2 moved the solver's answer there; the published maxBaseAnnual is its $100 floor). Since 2026-10-10 the evidence asserts feasibleBaseAnnual first, in both cases, so the mutant fails on the figure this record now also outputs: 63,125 against 62,500 in case 1, and 63,047 against 62,969 in case 2.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/spendingSolver.evidence.test.ts
```

## Captured failing output

Re-executed on 2026-10-10 because the evidence gained a second case and asserts feasibleBaseAnnual (D-MCP-CENSUS-PIN), which moved the test lines this receipt quotes; the mutation is unchanged. The baseline is green (spendingSolver.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/decisions/spendingSolver.evidence.test.ts (2 tests | 2 failed) 73ms
   ❯ sustainable-spending-bisection — Sustainable spending bisection (2)
     × bisects the 60000/70000 bracket to the feasible lower bound 62500 60ms
     × at a $100 resolution passes 62969 and publishes it rounded down to 62900 12ms

 Test Files  1 failed (1)
      Tests  2 failed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/spendingSolver.evidence.test.ts > sustainable-spending-bisection — Sustainable spending bisection > bisects the 60000/70000 bracket to the feasible lower bound 62500
AssertionError: feasibleBaseAnnual: actual 63125, worksheet 62500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectCase src/decisions/spendingSolver.evidence.test.ts:69:206

 ❯ src/decisions/spendingSolver.evidence.test.ts:80:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/decisions/spendingSolver.evidence.test.ts > sustainable-spending-bisection — Sustainable spending bisection > at a $100 resolution passes 62969 and publishes it rounded down to 62900
AssertionError: feasibleBaseAnnual: actual 63047, worksheet 62969: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectCase src/decisions/spendingSolver.evidence.test.ts:69:206

 ❯ src/decisions/spendingSolver.evidence.test.ts:84:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/spendingSolver.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/spendingSolver.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
