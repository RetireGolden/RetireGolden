# Mutation receipt: withdrawal-rate-guardrail-step

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/spending/guardrails.ts`

```diff
@@ -91,7 +91,7 @@ export function nextGuardrailMultiplier(
   }
 
   const ratio = currentRate / startingRate
-  if (ratio > upper) {
+  if (currentRate > upper) {
     const multiplier = clampRange(prev - adj, maxMultiplier)
     return { multiplier, action: multiplier < prev - 1e-9 ? 'cut' : 'hold' }
   }
```

This compares the raw current rate with the upper band instead of the ratio to the starting rate, the worksheet's second wrong reading: 0.06 is not above 1.2, so the mutated code holds at 0.8 instead of cutting to 0.7, a 0.1 miss against the 1e-12 tolerance. The inside-the-band hold and the zero-floor hold still pass, because those cases hold under either comparison.

## Command

```
npx vitest run src/spending/guardrails.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/spending/guardrails.evidence.test.ts (6 tests | 1 failed) 6ms
   ❯ withdrawal-rate-guardrail-step — Withdrawal-rate guardrail: one year's cut, raise or hold of the discretionary multiplier (3)
     × cuts the discretionary multiplier from 0.8 to 0.7 when a 6% rate exceeds 120% of the 4% starting rate 4ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/spending/guardrails.evidence.test.ts > withdrawal-rate-guardrail-step — Withdrawal-rate guardrail: one year's cut, raise or hold of the discretionary multiplier > cuts the discretionary multiplier from 0.8 to 0.7 when a 6% rate exceeds 120% of the 4% starting rate
AssertionError: multiplier 0.8 is not within {"abs":1e-12} of the worksheet's 0.7: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/spending/guardrails.evidence.test.ts:34:9
     32|         withinTolerance(decision.multiplier, expected, example.toleran…
     33|         `multiplier ${decision.multiplier} is not within ${JSON.string…
     34|       ).toBe(true)
       |         ^
     35|       expect(decision.action).toBe(example.expected.action)
     36|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
```

## Revert

`git checkout -- packages/engine/src/spending/guardrails.ts`, then `git diff --quiet -- packages/engine/src/spending/guardrails.ts` exited 0, confirming no change to production code after the run.
