# Mutation receipt: spending-debt-service-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts`

```diff
@@ -27,7 +27,6 @@
     if (account.type !== 'debt') continue
     let balance = shadow.get(account.id) ?? 0
     if (balance <= 0) continue
-    balance *= 1 + account.interestPct / 100
     // A scheduled payoff clears the whole remaining balance; otherwise the
     // level annual payment is capped so the loan self-terminates.
     const payoff =
```

This drops the interest growth, so each debt pays against its opening balance: Debt A pays its level $6,000 and Debt B pays off $1,000 rather than $1,120, publishing $7,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualDebtAndLongTermCare.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts (3 tests | 2 failed) 28ms
   ❯ spending-debt-service-annual — Annual debt service under the grow-then-pay convention (2)
     × grows each balance before paying, and pays Debt B out at its payoff year 4ms
     × publishes the same 7120 as expenses.debtService on a real 2030 ledger row 23ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)

  Transform  transforming modules took 2.42s · 43% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts > spending-debt-service-annual — Annual debt service under the grow-then-pay convention > grows each balance before paying, and pays Debt B out at its payoff year
AssertionError: Debt B payment 1000 is not within {"abs":0.005} of the worksheet's 1120: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:29:5
     27|     withinTolerance(actual, target, tolerance),
     28|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     29|   ).toBe(true)
       |     ^
     30| }
     31|
 ❯ src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:92:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts > spending-debt-service-annual — Annual debt service under the grow-then-pay convention > publishes the same 7120 as expenses.debtService on a real 2030 ledger row
AssertionError: expenses.debtService 7000 is not within {"abs":0.005} of the worksheet's 7120: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:29:5
     27|     withinTolerance(actual, target, tolerance),
     28|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     29|   ).toBe(true)
       |     ^
     30| }
     31|
 ❯ src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:124:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
