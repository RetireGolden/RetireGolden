# Mutation receipt: spending-care-cost-gross-and-ltc-benefit-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `0f51ee73` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts`

```diff
@@ -133,9 +133,6 @@
         12 *
         Math.pow(1 + rider, input.year - input.startYear)
       // The first episode year bears the elimination period out of pocket.
-      if (yearsIntoEpisode === 0) {
-        cap *= Math.max(0, 1 - policy.eliminationPeriodDays / 365)
-      }
       const pay = Math.min(remaining, cap)
       if (pay > 0) {
         ltcBenefit += pay
```

This drops the first-year elimination-period haircut on the policy cap, publishing a benefit of $66,150 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts
```

## Captured failing output

The independent review's fixes to D-2027-ROLLOVER moved the lines these receipts quote (the effective property sale year threaded through the property phases, the pre-start events for a sale and a debt payoff, the parameter test seam, and evidence cases added to the restated records); the mutations are unchanged. The baseline is green (annualDebtAndLongTermCare.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine21/packages/engine

 ❯ src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts (4 tests | 1 failed) 44ms
   ❯ spending-care-cost-gross-and-ltc-benefit-annual — Annual gross care cost and the LTC benefit against it (1)
     × charges 72600 of gross care and reimburses 49839.0410958904 after the elimination haircut 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts > spending-care-cost-gross-and-ltc-benefit-annual — Annual gross care cost and the LTC benefit against it > charges 72600 of gross care and reimburses 49839.0410958904 after the elimination haircut
AssertionError: expenses.ltcBenefit 66150 is not within {"abs":0.005} of the worksheet's 49839.0410958904: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualDebtAndLongTermCare.evidence.test.ts:251:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualDebtAndLongTermCare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
