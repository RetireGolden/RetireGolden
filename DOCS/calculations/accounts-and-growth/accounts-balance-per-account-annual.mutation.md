# Mutation receipt: accounts-balance-per-account-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualSnapshot.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualSnapshot.ts b/packages/engine/src/projection/internal/annualSnapshot.ts
index 80710ba6..52c7d84f 100644
--- a/packages/engine/src/projection/internal/annualSnapshot.ts
+++ b/packages/engine/src/projection/internal/annualSnapshot.ts
@@ -99,7 +99,7 @@ export function annualSnapshot(input: AnnualSnapshotInput): AnnualSnapshot {
   }
   let debtTotal = 0
   for (const [id, value] of debtBalances) {
-    balanceEntries.push([id, value])
+    balanceEntries.push([id, -value])
     debtTotal += value
   }
   let hecmLoanTotal = 0
```

Write the debt channel as a negative asset — the worksheet's second wrong reading. The map publishes debt-1 at -$26,000 instead of $26,000. The economic total is untouched (debtTotal still sums the positive balances), so only the per-id map the family publishes moves, which is what the record claims.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSnapshot.balances.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualSnapshot.balances.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualSnapshot.balances.evidence.test.ts (2 tests | 1 failed) 29ms
   ❯ accounts-balance-per-account-annual — Year-end balance map: one entry per id, written channel by channel (2)
     × writes each channel its own year-end figure, netting nothing across them 28ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

  Transform  transforming modules took 2.42s · 43% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualSnapshot.balances.evidence.test.ts > accounts-balance-per-account-annual — Year-end balance map: one entry per id, written channel by channel > writes each channel its own year-end figure, netting nothing across them
AssertionError: debt-1 -26000 is not within {"abs":0.005} of 26000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSnapshot.balances.evidence.test.ts:54:9
     52|         withinTolerance(actual, target, example.tolerance),
     53|         `${label} ${actual} is not within ${JSON.stringify(example.tol…
     54|       ).toBe(true)
       |         ^
     55|     }
     56|
 ❯ src/projection/internal/annualSnapshot.balances.evidence.test.ts:97:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualSnapshot.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualSnapshot.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
