# Mutation receipt: surplus-invested-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts`

```diff
@@ -1187,7 +1187,7 @@
     // The caller retains observable live line/map mutation, coordinated-then-
     // backstop accumulation, capture gating, and downstream residual use.
     // Those effects make this application loop orchestration, not HECM policy.
-    const surplus = Math.max(0, cashInflows - expenses.total - contributions - tax - penalties)
+    const surplus = Math.max(0, cashInflows - expenses.total - tax - penalties)
     const iraCharacterFinal = needBasedOwnedIraCharacter(
       withdrawalPlan.byAccountId,
     )
```

This omits contributions from the residual, publishing $40,000 — the worksheet's first wrong reading. The same mutation also publishes $5,000 where the floored case must publish $0.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/simulate.evidence.test.ts > surplus-invested-annual — Annual surplus invested, floored at zero > publishes 30000 of residual cash and credits it to the lowest-id cash account
AssertionError: surplusInvested 40000 is not within {"abs":0.005} of the worksheet's 30000: expected false to be true // Object.is equality
 FAIL  src/projection/simulate.evidence.test.ts > surplus-invested-annual — Annual surplus invested, floored at zero > floors a 5000 negative residual at zero instead of publishing it
AssertionError: expected 5000 to be +0 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts` exited 0, confirming no change to production code after the run.
