# Mutation receipt: spending-debt-service-annual

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

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

```
 FAIL  src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts > spending-debt-service-annual — Annual debt service under the grow-then-pay convention > grows each balance before paying, and pays Debt B out at its payoff year
AssertionError: Debt B payment 1000 is not within {"abs":0.005} of the worksheet's 1120: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts > spending-debt-service-annual — Annual debt service under the grow-then-pay convention > publishes the same 7120 as expenses.debtService on a real 2030 ledger row
AssertionError: expenses.debtService 7000 is not within {"abs":0.005} of the worksheet's 7120: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts` exited 0, confirming no change to production code after the run.
