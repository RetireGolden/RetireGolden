# Mutation receipt: projection-result-ending-investable

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
@@ -2878,7 +2878,7 @@ export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResul
     endYear,
     years,
     depletionYear,
-    endingInvestable: last?.investableTotal ?? 0,
+    endingInvestable: years[0]?.investableTotal ?? 0,
     endingNetWorth: last?.netWorth ?? 0,
     endingNondeductibleIraBasis,
     warnings: [...warnings],
```

This copies the first year row instead of the last, publishing $510,000 — the worksheet's first wrong reading. The ending-net-worth fixture in the same file fails alongside, because it reads the gap between the two terminal fields.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/simulate.evidence.test.ts > projection-result-ending-investable — Projection-result ending investable balance > republishes the 2031 row and not the 2030 one
AssertionError: endingInvestable 510000 is not within {"abs":0.005} of the worksheet's 487250.125: expected false to be true // Object.is equality
 FAIL  src/projection/simulate.evidence.test.ts > projection-result-ending-net-worth — Projection-result ending net worth > republishes the 2031 row and never substitutes ending investable
AssertionError: net worth above ending investable 391375.625 is not within {"abs":0.005} of the worksheet's 415000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/simulate.ts`, then `git diff --quiet -- packages/engine/src/projection/simulate.ts` exited 0, confirming no change to production code after the run.
