# Mutation receipt: spending-debt-service-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `0f51ee73` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

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

The independent review's fixes to D-2027-ROLLOVER moved the lines these receipts quote (the effective property sale year threaded through the property phases, the pre-start events for a sale and a debt payoff, the parameter test seam, and evidence cases added to the restated records); the mutations are unchanged. The baseline is green (annualDebtAndLongTermCare.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts (4 tests | 3 failed) 45ms
   ❯ spending-debt-service-annual — Annual debt service under the grow-then-pay convention (3)
     × grows each balance before paying, and pays Debt B out at its payoff year 5ms
     × publishes the same 7120 as expenses.debtService on a real 2030 ledger row 27ms
     × names a payoff dated before the start with what the ledger pays in the first year (restated 2026-09-29) 11ms

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts > spending-debt-service-annual — Annual debt service under the grow-then-pay convention > grows each balance before paying, and pays Debt B out at its payoff year
AssertionError: Debt B payment 1000 is not within {"abs":0.005} of the worksheet's 1120: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:30:5
     28|     withinTolerance(actual, target, tolerance),
     29|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     30|   ).toBe(true)
       |     ^
     31| }
     32|
 ❯ src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:93:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts > spending-debt-service-annual — Annual debt service under the grow-then-pay convention > publishes the same 7120 as expenses.debtService on a real 2030 ledger row
AssertionError: expenses.debtService 7000 is not within {"abs":0.005} of the worksheet's 7120: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:30:5
     28|     withinTolerance(actual, target, tolerance),
     29|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     30|   ).toBe(true)
       |     ^
     31| }
     32|
 ❯ src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:125:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts > spending-debt-service-annual — Annual debt service under the grow-then-pay convention > names a payoff dated before the start with what the ledger pays in the first year (restated 2026-09-29)
AssertionError: expenses.debtService 1000 is not within {"abs":0.005} of the worksheet's 1120: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:30:5
     28|     withinTolerance(actual, target, tolerance),
     29|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     30|   ).toBe(true)
       |     ^
     31| }
     32|
 ❯ src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:153:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
