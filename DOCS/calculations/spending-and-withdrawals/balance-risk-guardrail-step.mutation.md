# Mutation receipt: balance-risk-guardrail-step

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/spending/guardrails.ts`

```diff
@@ -136,7 +136,7 @@ export function nextBalanceGuardrailMultiplier(
     return { multiplier: prev, action: 'hold' }
   }
   if (lower !== null && currentRealBalance < lower) {
-    const multiplier = clampRange(prev - adj, maxMultiplier)
+    const multiplier = clampRange(prev * (1 - adj), maxMultiplier)
     return { multiplier, action: multiplier < prev - 1e-9 ? 'cut' : 'hold' }
   }
   if (upper !== null && currentRealBalance > upper) {
```

This cuts by 10% of the previous multiplier instead of by 10 percentage points of the full discretionary layer: 0.8 x 0.9 = 0.72 instead of 0.8 - 0.1 = 0.7, a 0.02 miss against the 1e-12 tolerance. The action is still reported as cut, so only the multiplier assertion fails; the no-threshold and inverted-pair holds are untouched.

## Command

```
npx vitest run src/spending/guardrails.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/spending/guardrails.evidence.test.ts (6 tests | 1 failed) 7ms
   ❯ balance-risk-guardrail-step — Risk-based guardrail: one year's cut, raise or hold against real-balance thresholds (3)
     × cuts from 0.8 to 0.7 when the $70 real balance falls below the $80 lower threshold 4ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/spending/guardrails.evidence.test.ts > balance-risk-guardrail-step — Risk-based guardrail: one year's cut, raise or hold against real-balance thresholds > cuts from 0.8 to 0.7 when the $70 real balance falls below the $80 lower threshold
AssertionError: multiplier 0.7200000000000001 is not within {"abs":1e-12} of the worksheet's 0.7: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/spending/guardrails.evidence.test.ts:87:9
     85|         withinTolerance(decision.multiplier, expected, example.toleran…
     86|         `multiplier ${decision.multiplier} is not within ${JSON.string…
     87|       ).toBe(true)
       |         ^
     88|       expect(decision.action).toBe(example.expected.action)
     89|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

## Revert

`git checkout -- packages/engine/src/spending/guardrails.ts`, then `git diff --quiet -- packages/engine/src/spending/guardrails.ts` exited 0, confirming no change to production code after the run.
