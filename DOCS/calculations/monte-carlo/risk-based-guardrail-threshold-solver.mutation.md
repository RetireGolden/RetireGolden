# Mutation receipt: risk-based-guardrail-threshold-solver

Re-executed 2026-09-18 after the worksheet re-derivation against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/riskBasedGuardrails.ts`

```diff
--- a/packages/engine/src/montecarlo/riskBasedGuardrails.ts
+++ b/packages/engine/src/montecarlo/riskBasedGuardrails.ts
@@ mutation @@
-const MIN_BALANCE_FRAC = 0.02
+const MIN_BALANCE_FRAC = 0
```

Forgets the 0.02 lower endpoint so the lattice is 4/1024 rather than 3.98/1024. At the solved edge, `(balanceFrac - 0.02) * 1024 / 3.98` is 17.969849246231156, not an integer (the worksheet's first wrong reading).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/riskBasedGuardrails.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts (2 tests | 1 failed) 143ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

   ❯ risk-based-guardrail-threshold-solver — Risk-based guardrail threshold bisection (1)
     × one-path 70/95 edges sit on the 10-step lattice or share a named non-solved outcome 135ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

 FAIL  src/montecarlo/riskBasedGuardrails.evidence.test.ts > risk-based-guardrail-threshold-solver — Risk-based guardrail threshold bisection > one-path 70/95 edges sit on the 10-step lattice or share a named non-solved outcome
AssertionError: lower (balanceFrac - 0.02) * 1024 / 3.98 = 17.969849246231156 is not an integer within {"abs":1e-9}: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ assertEdge src/montecarlo/riskBasedGuardrails.evidence.test.ts:147:11
    145|           withinTolerance(recovered, k, example.tolerance),
    146|           `${label} (balanceFrac - ${bracketLo}) * ${steps} / ${span} …
    147|         ).toBe(true)
       |           ^
    148|         expect(k >= kMin && k <= kMax, `${label} lattice k ${k} is not…
    149|         expect(edge.balanceDollars, `${label} balanceDollars ${edge.ba…
 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts:159:25

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/riskBasedGuardrails.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/riskBasedGuardrails.ts` exited 0, confirming no change to production code after the run.
