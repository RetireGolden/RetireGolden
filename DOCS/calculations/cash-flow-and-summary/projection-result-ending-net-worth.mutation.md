# Mutation receipt: projection-result-ending-net-worth

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
@@ -2879,7 +2879,7 @@ export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResul
     years,
     depletionYear,
     endingInvestable: last?.investableTotal ?? 0,
-    endingNetWorth: last?.netWorth ?? 0,
+    endingNetWorth: last?.investableTotal ?? 0,
     endingNondeductibleIraBasis,
     warnings: [...warnings],
   }
```

This substitutes ending investable for net worth, publishing $486,375.625 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/simulate.evidence.test.ts > projection-result-ending-net-worth — Projection-result ending net worth > republishes the 2031 row and never substitutes ending investable
AssertionError: endingNetWorth 486375.625 is not within {"abs":0.005} of the worksheet's 901375.625: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/simulate.ts`, then `git diff --quiet -- packages/engine/src/projection/simulate.ts` exited 0, confirming no change to production code after the run.
