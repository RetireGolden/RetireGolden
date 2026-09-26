# Mutation receipt: risk-based-starting-investable

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-26 against RetireGolden base `fe6233de` (branch `claude/monte-carlo-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/riskBasedGuardrails.ts`

```diff
--- a/packages/engine/src/montecarlo/riskBasedGuardrails.ts
+++ b/packages/engine/src/montecarlo/riskBasedGuardrails.ts
@@ mutation @@
-const INVESTABLE_ACCOUNT_TYPES = new Set(['taxable', 'equityComp', 'traditional', 'roth', 'hsa', 'cash'])
+const INVESTABLE_ACCOUNT_TYPES = new Set(['taxable', 'equityComp', 'traditional', 'roth', 'hsa', 'cash', 'property'])
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

Re-executed because this branch added tests to the evidence file, so the test counts and quoted line numbers recorded earlier no longer matched it. The baseline is green (riskBasedGuardrails.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts (5 tests | 1 failed) 25ms
   ❯ risk-based-starting-investable — Starting investable: sum of listed account balances (1)
     × sums taxable $100,000 and cash $20,000; the $300,000 home is excluded 18ms

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
