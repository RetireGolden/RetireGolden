# Mutation receipt: projection-money-tolerance-thresholds

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/moneyTolerance.ts`

```diff
diff --git a/packages/engine/src/projection/moneyTolerance.ts b/packages/engine/src/projection/moneyTolerance.ts
index 9f2fef72..8ae4bce3 100644
--- a/packages/engine/src/projection/moneyTolerance.ts
+++ b/packages/engine/src/projection/moneyTolerance.ts
@@ -8,7 +8,7 @@
  * Keep reporting consumers on this shared constant so they do not reject a
  * result that the ledger itself accepted.
  */
-export const ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS = 0.005
+export const ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS = 0.05
 
 /**
  * One cent: the aggregate Roth conversion phase's "not worth acting on" floor.
```

Replace the half-cent annual tolerance with five cents.

## Command

```
npx.cmd vitest run src/projection/moneyTolerance.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/projection/moneyTolerance.evidence.test.ts (1 test | 1 failed) 4ms
   ❯ projection-money-tolerance-thresholds — Projection money tolerance thresholds (1)
     × accepts a 0.0049 annual residual but rejects 0.0075 as a material conversion 4ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/moneyTolerance.evidence.test.ts > projection-money-tolerance-thresholds — Projection money tolerance thresholds > accepts a 0.0049 annual residual but rejects 0.0075 as a material conversion
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/moneyTolerance.evidence.test.ts:17:129
     15|     expect((example.inputs.annualResidual as number) <= ANNUAL_FUNDING…
     16|     expect((example.inputs.conversionCandidate as number) > AGGREGATE_…
     17|     expect(withinTolerance(ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS, exam…
       |                                                                                                                                 ^
     18|     expect(withinTolerance(AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLL…
     19|     expect(withinTolerance(AGGREGATE_ROTH_CONVERSION_EPSILON_PLAN_DOLL…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/projection/moneyTolerance.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration. The restored named file passed (exit 0).
