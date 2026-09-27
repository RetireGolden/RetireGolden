# Mutation receipt: cash-flow-drilldown-amounts

Executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/annualCashFlowReconciliation.ts`

```diff
diff --git a/packages/engine/src/projection/annualCashFlowReconciliation.ts b/packages/engine/src/projection/annualCashFlowReconciliation.ts
index 508e5399..f24ec4cc 100644
--- a/packages/engine/src/projection/annualCashFlowReconciliation.ts
+++ b/packages/engine/src/projection/annualCashFlowReconciliation.ts
@@ -192,5 +192,5 @@
     requestedUsesPlanDollars += line.requestedPlanDollars
     fundedUsesPlanDollars += line.fundedPlanDollars
-    unfundedUsesPlanDollars += line.unfundedPlanDollars
+    unfundedUsesPlanDollars += line.fundedPlanDollars
   }
   const dispositionTotalPlanDollars = fundedUsesPlanDollars + unfundedUsesPlanDollars
```

Sizes the Unfunded node by the funded uses, one of the worksheet's wrong readings: the case's five use lines publish 5,000 of unfunded uses instead of 1,800.85.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/annualCashFlowReconciliation.drilldown.evidence.test.ts
```

## Captured failing output

Executed for B2-P1 slice 2. The baseline is green (annualCashFlowReconciliation.drilldown.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/projection/annualCashFlowReconciliation.drilldown.evidence.test.ts (2 tests | 1 failed) 6ms
   ❯ cash-flow-drilldown-amounts — Cash-flow drilldown amounts (2)
     × the Unfunded node is the use identity unfunded total, the same as the positive lines added 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/annualCashFlowReconciliation.drilldown.evidence.test.ts > cash-flow-drilldown-amounts — Cash-flow drilldown amounts > the Unfunded node is the use identity unfunded total, the same as the positive lines added
AssertionError: expected 5000 to be 1800.85 // Object.is equality

- Expected
+ Received

- 1800.85
+ 5000

 ❯ src/projection/annualCashFlowReconciliation.drilldown.evidence.test.ts:121:24
    119|     it('the Unfunded node is the use identity unfunded total, the same…
    120|       const unfunded = reconcile().uses.unfundedUsesPlanDollars
    121|       expect(unfunded).toBe(expected.unfunded)
       |                        ^
    122|       let positive = 0
    123|       for (const amount of inputs.unfunded) if (amount > 0) positive +…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/annualCashFlowReconciliation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/annualCashFlowReconciliation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
