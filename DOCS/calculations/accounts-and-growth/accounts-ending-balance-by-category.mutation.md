# Mutation receipt: accounts-ending-balance-by-category

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
@@ -227,7 +227,7 @@
   if (last) {
     for (const account of selectedLogicalBalanceAccounts(plan.accounts)) {
       if (account.type in endingByCategory) {
-        endingByCategory[account.type as keyof typeof endingByCategory] += last.balances[account.id] ?? 0
+        endingByCategory[account.type as keyof typeof endingByCategory] += result.years[0]?.balances[account.id] ?? 0
       }
     }
   }
```

This reads the penultimate ledger row instead of the last one, publishing that earlier row's category totals — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/compareSummary.evidence.test.ts > accounts-ending-balance-by-category — Ending balances by logical account category > folds the two taxable accounts into 25000 and reads only the last ledger year
AssertionError: endingByCategory.cash: actual 1, worksheet 10000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/compare.ts`, then `git diff --quiet -- packages/engine/src/projection/compare.ts` exited 0, confirming no change to production code after the run.
