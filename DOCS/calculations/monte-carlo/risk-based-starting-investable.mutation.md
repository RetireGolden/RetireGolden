# Mutation receipt: risk-based-starting-investable

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/riskBasedGuardrails.ts`

```diff
diff --git a/packages/engine/src/montecarlo/riskBasedGuardrails.ts b/packages/engine/src/montecarlo/riskBasedGuardrails.ts
index a0e0bc3b..0e68eafc 100644
--- a/packages/engine/src/montecarlo/riskBasedGuardrails.ts
+++ b/packages/engine/src/montecarlo/riskBasedGuardrails.ts
@@ -37,7 +37,7 @@ const MAX_BALANCE_FRAC = 4
 const BALANCE_BISECTION_ITERATIONS = 10
 const SPENDING_BISECTION_ITERATIONS = 8
 
-const INVESTABLE_ACCOUNT_TYPES = new Set(['taxable', 'equityComp', 'traditional', 'roth', 'hsa', 'cash'])
+const INVESTABLE_ACCOUNT_TYPES = new Set(['taxable', 'equityComp', 'traditional', 'roth', 'hsa', 'cash', 'property'])
 
 export interface RiskBasedGuardrailSolveOptions {
   startYear: number
@@ -162,6 +162,7 @@ export function startingInvestableOf(plan: Plan): number {
   let total = 0
   for (const account of plan.accounts) {
     if (isInvestable(account) && 'balance' in account) total += account.balance
+    else if (account.type === 'property' && 'value' in account) total += account.value
   }
   return total
 }
```

Adds property to the investable set. Property stores `value` not `balance`, so this mutation is paired with reading value so the home is summed.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/riskBasedGuardrails.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after merging RetireGolden #751 into B2-P1 slice 2: the drift check #751 adds flagged this receipt against the slice's code (a hunk header naming a line the code has moved from, a context line the slice changed, a header naming no line, or a stated test count the slice's evidence file no longer has), so the diff header, capture, blob hash and revert note are refreshed against this head. The baseline is green (riskBasedGuardrails.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts (5 tests | 1 failed) 16ms
   ❯ risk-based-starting-investable — Starting investable: sum of listed account balances (1)
     × sums taxable $100,000 and cash $20,000; the $300,000 home is excluded 12ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/riskBasedGuardrails.evidence.test.ts > risk-based-starting-investable — Starting investable: sum of listed account balances > sums taxable $100,000 and cash $20,000; the $300,000 home is excluded
AssertionError: expected 420000 to be 120000 // Object.is equality

- Expected
+ Received

- 120000
+ 420000

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts:74:42
     72|         home(example.inputs.home as number),
     73|       ])
     74|       expect(startingInvestableOf(plan)).toBe(example.expected.startin…
       |                                          ^
     75|     })
     76|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/riskBasedGuardrails.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/riskBasedGuardrails.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
