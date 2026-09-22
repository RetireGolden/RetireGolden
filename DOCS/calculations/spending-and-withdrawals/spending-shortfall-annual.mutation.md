# Mutation receipt: spending-shortfall-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualHecmBackstop.ts`

```diff
@@ -75,6 +75,6 @@ export function annualHecmBackstopPlan(
   return {
     allocations,
     draw,
-    shortfallAfterHecm: Math.max(0, input.portfolioShortfall - draw),
+    shortfallAfterHecm: Math.max(0, input.portfolioShortfall),
   }
 }
```

This publishes the pre-HECM gap, $2,000, instead of the gap left after the backstop draw — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualHecmBackstop.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualHecmBackstop.evidence.test.ts > spending-shortfall-annual — Annual funding shortfall after the HECM backstop > publishes the 500 left after 10000 of withdrawals and a 1500 HECM draw
AssertionError: shortfall: actual 2000, worksheet 500: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualHecmBackstop.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualHecmBackstop.ts` exited 0, confirming no change to production code after the run.
