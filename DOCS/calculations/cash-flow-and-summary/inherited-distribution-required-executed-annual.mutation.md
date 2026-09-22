# Mutation receipt: inherited-distribution-required-executed-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualInheritedIraDistributions.ts`

```diff
@@ -461,7 +461,7 @@
       } else if (req.kind === 'none' || req.noticeWaived === true) {
         take = 0
       } else {
-        take = Math.min(req.requiredAmount, state.balance)
+        take = req.requiredAmount
       }
       regime = scheduleClass.regime
       matrixRow = scheduleClass.row
```

This executes the uncapped requirement, overdrawing the $5,000 live balance by $3,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualInheritedIraDistributions.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualInheritedIraDistributions.evidence.test.ts > inherited-distribution-required-executed-annual — Executed inherited required distribution > caps an ordinary requirement at the live balance and never above it
AssertionError: expected 8000 to be 5000 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualInheritedIraDistributions.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualInheritedIraDistributions.ts` exited 0, confirming no change to production code after the run.
