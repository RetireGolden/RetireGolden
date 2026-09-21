# Mutation receipt: risk-based-starting-investable

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/riskBasedGuardrails.ts`

```diff
--- a/packages/engine/src/montecarlo/riskBasedGuardrails.ts
+++ b/packages/engine/src/montecarlo/riskBasedGuardrails.ts
@@ mutation @@
-const INVESTABLE_ACCOUNT_TYPES = new Set(['taxable', 'equityComp', 'traditional', 'roth', 'hsa', 'cash'])
+const INVESTABLE_ACCOUNT_TYPES = new Set(['taxable', 'equityComp', 'traditional', 'roth', 'hsa', 'cash', 'property'])
--- a/packages/engine/src/montecarlo/riskBasedGuardrails.ts
+++ b/packages/engine/src/montecarlo/riskBasedGuardrails.ts
@@ mutation @@
-if (isInvestable(account) && 'balance' in account) total += account.balance
+if (isInvestable(account) && 'balance' in account) total += account.balance
+    else if (account.type === 'property' && 'value' in account) total += account.value
```

Adds property to the investable set. Property stores `value` not `balance`, so this mutation is paired with reading value so the home is summed.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/riskBasedGuardrails.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts (1 test | 1 failed) 11ms
   ❯ risk-based-starting-investable — Starting investable: sum of listed account balances (1)
     × sums taxable $100,000 and cash $20,000; the $300,000 home is excluded 10ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


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

`git checkout -- packages/engine/src/montecarlo/riskBasedGuardrails.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/riskBasedGuardrails.ts` exited 0, confirming no change to production code after the run.
