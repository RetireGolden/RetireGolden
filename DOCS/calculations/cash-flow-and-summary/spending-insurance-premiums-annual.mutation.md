# Mutation receipt: spending-insurance-premiums-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualInsurancePremiumRows.ts`

```diff
@@ -40,7 +40,6 @@
   const rows: AnnualInsurancePremiumRow[] = []
 
   for (const policy of input.policies) {
-    if (policy.premiumMode === 'paidUp') continue
 
     const subjectPersonId = policy.kind === 'ltc' ? policy.owner : policy.insured
     const subject = input.resolveSubject(subjectPersonId)
```

This charges the paid-up Life B as well, publishing $2,100 against the worksheet's $1,200 primary case and adding `life-b` to the charged rows.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualInsurancePremiumRows.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (annualInsurancePremiumRows.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/annualInsurancePremiumRows.evidence.test.ts (3 tests | 1 failed) 6ms
   ❯ spending-insurance-premiums-annual — Annual level insurance premiums (3)
     × charges 1200: the lifetime policy alone, with the paid-up, at-end-age and past-end-age policies skipped 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualInsurancePremiumRows.evidence.test.ts > spending-insurance-premiums-annual — Annual level insurance premiums > charges 1200: the lifetime policy alone, with the paid-up, at-end-age and past-end-age policies skipped
AssertionError: expenses.insurancePremiums 2100 is not within {"abs":0.005} of the worksheet's 1200: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualInsurancePremiumRows.evidence.test.ts:16:5
     14|     withinTolerance(actual, target, tolerance),
     15|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     16|   ).toBe(true)
       |     ^
     17| }
     18|
 ❯ src/projection/internal/annualInsurancePremiumRows.evidence.test.ts:112:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualInsurancePremiumRows.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualInsurancePremiumRows.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
