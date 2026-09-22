# Mutation receipt: spending-insurance-premiums-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualInsurancePremiumRows.ts`

```diff
@@ -34,7 +34,6 @@
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

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualInsurancePremiumRows.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualInsurancePremiumRows.evidence.test.ts (3 tests | 1 failed) 5ms
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
