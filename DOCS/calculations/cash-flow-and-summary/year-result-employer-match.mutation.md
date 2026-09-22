# Mutation receipt: year-result-employer-match

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts`

```diff
@@ -737,7 +737,6 @@
     const match415cKey = employerPlanScopeKey(ownerId, account)
     const usedSoFar = addition415cUsed.get(match415cKey) ?? 0
     const remaining415cLimit = Math.max(0, limit415c - usedSoFar)
-    matchVal = Math.min(matchVal, remaining415cLimit)
     if (matchVal <= 0) continue
 
     const balanceBefore = shadowBalances[balanceIndex]!
```

This drops the IRC §415(c) cap on the raw match, publishing $49,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/simulate.evidence.test.ts > year-result-employer-match — Annual employer match under the pay cap and the annual-additions limit > caps the 49000 raw match at the 47500 of §415(c) room left after the deferral
AssertionError: employerMatch 49000 is not within {"abs":0.005} of the worksheet's 47500: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts` exited 0, confirming no change to production code after the run.
