# Mutation receipt: spending-property-costs-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts`

```diff
@@ -43,8 +43,8 @@
     if (account.plannedSaleYear !== null && input.year >= account.plannedSaleYear) continue
 
     const amount =
-      ((account.propertyTaxAnnual ?? 0) + (account.insuranceAnnual ?? 0)) *
-      input.inflFactor
+      (account.propertyTaxAnnual ?? 0) * input.inflFactor +
+      (account.insuranceAnnual ?? 0)
     const record: RecordedAccountAmount = {
       accountId: account.id,
       ownerPersonId: account.ownerPersonId ?? null,
```

This inflates the property tax but not the homeowner insurance, publishing $4,500 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualPropertyCarryingCosts.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts (2 tests | 1 failed) 6ms
   ❯ spending-property-costs-annual — Annual property carrying costs on owned properties (2)
     × inflates both carrying components on Home A and charges nothing in Home B sale year 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts > spending-property-costs-annual — Annual property carrying costs on owned properties > inflates both carrying components on Home A and charges nothing in Home B sale year
AssertionError: Home A carrying cost 4500 is not within {"abs":0.005} of the worksheet's 4620: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts:16:5
     14|     withinTolerance(actual, target, tolerance),
     15|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     16|   ).toBe(true)
       |     ^
     17| }
     18|
 ❯ src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts:75:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
