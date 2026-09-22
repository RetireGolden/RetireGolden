# Mutation receipt: accounts-ending-balance-by-category

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (19 tests | 1 failed) 21ms
   ❯ accounts-ending-balance-by-category — Ending balances by logical account category (1)
     × folds the two taxable accounts into 25000 and reads only the last ledger year 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 18 passed (19)

  Transform  transforming modules took 2.35s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > accounts-ending-balance-by-category — Ending balances by logical account category > folds the two taxable accounts into 25000 and reads only the last ledger year
AssertionError: endingByCategory.cash: actual 1, worksheet 10000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:929:11
    927|           withinTolerance(summary.endingByCategory[category], expected…
    928|           `endingByCategory.${category}: actual ${summary.endingByCate…
    929|         ).toBe(true)
       |           ^
    930|       }
    931|       // The penultimate row's categories are not what the summary pub…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
