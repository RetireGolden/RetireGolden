# Mutation receipt: accounts-ending-balance-by-category

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8` and 2026-09-22 against base `fca01300` (pull request #730) on the inline category loop, which B2-P1 slice 1 replaced on 2026-09-26 by `projection/yearFigures.ts#balancesByCategory` read for the last row; the same mutation is rewritten below for that code, and re-executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `94954596` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 06828f33..f9c16470 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -243,3 +243,3 @@
     // id), read for the last row; equity compensation is not one of these five.
-    const lastByCategory = balancesByCategory(plan, last)
+    const lastByCategory = balancesByCategory(plan, result.years[0] ?? last)
     endingByCategory.cash = lastByCategory.cash
```

This reads the penultimate ledger row instead of the last one, publishing that earlier row's category totals — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 on B2-P1 slice 3, which moved the lines this receipt quotes (new comparison fields, basis doc comments and helper calls in the production file, or new cases and fixture fields in the evidence file) without changing the mutation, so the hunk header, capture, blob hash and revert note are refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine11/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (19 tests | 1 failed) 21ms
   ❯ accounts-ending-balance-by-category — Ending balances by logical account category (1)
     × folds the two taxable accounts into 25000 and reads only the last ledger year 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 18 passed (19)

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
