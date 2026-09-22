# Mutation receipt: year-result-contributions

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts`

```diff
@@ -496,7 +496,7 @@
     }
     if (groupKey !== null && !isEmployerAccount) {
       const used = groupUsed.get(groupKey) ?? 0
-      allowed = Math.max(0, Math.min(desired, limit - used))
+      allowed = desired
     }
     // IRC 415(c)(1)-(2) charges non-catch-up deferrals first; 414(v)(3)(A) excludes catch-up from the lesser-of-dollar-or-pay cap.
     const section415cKey = employerPlanScopeKey(ownerId, account)
```

This credits each owner's desired amount without trimming it to the IRA limit, publishing $15,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/simulate.evidence.test.ts > year-result-contributions — Annual contributions credited after limit trimming > trims Owner B to the 7500 IRA limit and leaves Owner A at 6000
AssertionError: contributions 15000 is not within {"abs":0.005} of the worksheet's 13500: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts` exited 0, confirming no change to production code after the run.
