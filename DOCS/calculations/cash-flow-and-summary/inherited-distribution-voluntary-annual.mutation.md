# Mutation receipt: inherited-distribution-voluntary-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualWithdrawalApplyFlowPlan.ts`

```diff
@@ -84,7 +84,7 @@
       evidenceAccount !== undefined &&
       (evidenceAccount.type === 'traditional' ||
         evidenceAccount.type === 'roth') &&
-      isTreatAsOwnEffective(evidenceAccount, input.year, input.ownerTreatmentRouting)
+      false
     ) continue
     evidenceWrites.push({
       evidenceIndex,
```

This ignores the treat-as-own routing, so an account under owner treatment still receives an inherited voluntary evidence write — the worksheet's third wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualWithdrawalApplyFlowPlan.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualWithdrawalApplyFlowPlan.evidence.test.ts > inherited-distribution-voluntary-annual — Voluntary inherited-account draw > writes no inherited voluntary row at all once treat-as-own is effective
AssertionError: expected [ { evidenceIndex: +0, …(2) } ] to deeply equal []
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualWithdrawalApplyFlowPlan.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualWithdrawalApplyFlowPlan.ts` exited 0, confirming no change to production code after the run.
