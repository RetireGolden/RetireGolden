# Mutation receipt: income-one-time-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/otherIncomeStreams.ts`

```diff
@@ -261,7 +261,7 @@ export function otherIncomeStreams(
       })
     } else if (stream.type === 'oneTime') {
       if (stream.year !== year) continue
-      const amount = stream.amount * (stream.inflationAdjusted ? inflFactor : 1)
+      const amount = stream.amount
       rows.push({
         kind: 'oneTime',
         amount,
```

This treats the amount as already nominal, publishing $50,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/otherIncomeStreams.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/otherIncomeStreams.evidence.test.ts > income-one-time-annual — Annual one-time income > inflates a 50000 capital-gain payment to 56000 in its named year
AssertionError: oneTime: actual 50000, worksheet 56000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/otherIncomeStreams.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/otherIncomeStreams.ts` exited 0, confirming no change to production code after the run.
