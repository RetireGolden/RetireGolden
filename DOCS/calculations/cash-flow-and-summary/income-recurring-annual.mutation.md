# Mutation receipt: income-recurring-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/otherIncomeStreams.ts`

```diff
@@ -248,7 +248,7 @@ export function otherIncomeStreams(
   for (const stream of incomes) {
     if (stream.type === 'recurring') {
       if ((stream.startYear !== null && year < stream.startYear) || (stream.endYear !== null && year > stream.endYear)) continue
-      const amount = stream.annualAmount * (stream.inflationAdjusted ? inflFactor : 1)
+      const amount = stream.annualAmount
       rows.push({
         kind: 'recurring',
         amount,
```

This ignores the inflation election, publishing $12,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/otherIncomeStreams.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/otherIncomeStreams.evidence.test.ts > income-recurring-annual — Annual recurring household income > inflates a 12000 tax-free stream to 12960 inside its window
AssertionError: recurring: actual 12000, worksheet 12960: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/otherIncomeStreams.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/otherIncomeStreams.ts` exited 0, confirming no change to production code after the run.
