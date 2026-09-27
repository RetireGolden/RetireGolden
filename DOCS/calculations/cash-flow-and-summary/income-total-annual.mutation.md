# Mutation receipt: income-total-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `15478aa9` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `5f917180` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d5fd40c` (branch `claude/social-security-law-2`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
@@ -1855,8 +1855,7 @@ export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResul
       incomes.tipsLadder +
       incomes.recurring +
       incomes.oneTime +
-      incomes.taxableYield +
-      incomes.taxExemptInterest
+      incomes.taxableYield
 
     // --- expenses ---------------------------------------------------------
     // The phase lives in `internal/annualExpenseAssemblyPhase.ts`: lifestyle
```

This drops tax-exempt interest from the nine-member sum, publishing $93,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

Re-executed for decision D-SS-LAW-2 because lines were added above its hunk (the cost-of-living increases since eligibility); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (simulate.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine12/packages/engine

 ❯ src/projection/simulate.evidence.test.ts (9 tests | 1 failed) 56ms
   ❯ income-total-annual — Annual cash-income total (1)
     × sums the nine members to 93500 and counts the character fields once 32ms

 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/simulate.evidence.test.ts > income-total-annual — Annual cash-income total > sums the nine members to 93500 and counts the character fields once
AssertionError: incomes.total 93000 is not within {"abs":0.005} of the worksheet's 93500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/simulate.evidence.test.ts:35:5
     33|     withinTolerance(actual, target, tolerance),
     34|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     35|   ).toBe(true)
       |     ^
     36| }
     37|
 ❯ src/projection/simulate.evidence.test.ts:156:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/simulate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/simulate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
