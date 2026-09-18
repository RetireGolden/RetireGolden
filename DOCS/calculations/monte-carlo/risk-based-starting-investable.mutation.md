# Mutation receipt: risk-based-starting-investable

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

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
npx vitest run src/montecarlo/riskBasedGuardrails.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts (2 tests | 2 failed) 147ms
   ❯ risk-based-starting-investable — Starting investable: sum of listed account balances (1)
     × sums taxable $100,000 and cash $20,000; the $300,000 home is excluded 11ms
   ❯ risk-based-guardrail-threshold-solver — Risk-based guardrail threshold bisection (1)
     × S(f) = min(1, f/2) crosses 70% at 1.40 / $700,000 and 95% at 1.90 / $950,000 135ms

 Test Files  1 failed (1)
      Tests  2 failed (2)

(node:34616) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:28184) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/riskBasedGuardrails.evidence.test.ts > risk-based-starting-investable — Starting investable: sum of listed account balances > sums taxable $100,000 and cash $20,000; the $300,000 home is excluded
AssertionError: expected 420000 to be 120000 // Object.is equality

- Expected
+ Received

- 120000
+ 420000

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts:75:42
     73|         home(example.inputs.home as number),
     74|       ])
     75|       expect(startingInvestableOf(plan)).toBe(example.expected.startin…
       |                                          ^
     76|     })
     77|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/montecarlo/riskBasedGuardrails.evidence.test.ts > risk-based-guardrail-threshold-solver — Risk-based guardrail threshold bisection > S(f) = min(1, f/2) crosses 70% at 1.40 / $700,000 and 95% at 1.90 / $950,000
AssertionError: lowerFrac 0.0899609375 is not within {"abs":0.00390625} of the worksheet's 1.4: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts:123:9
    121|         withinTolerance(lowerFrac, expectedLower, example.tolerance),
    122|         `lowerFrac ${lowerFrac} is not within ${JSON.stringify(example…
    123|       ).toBe(true)
       |         ^
    124|       expect(
    125|         withinTolerance(upperFrac, expectedUpper, example.tolerance),

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/riskBasedGuardrails.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/riskBasedGuardrails.ts` exited 0, confirming no change to production code after the run.
