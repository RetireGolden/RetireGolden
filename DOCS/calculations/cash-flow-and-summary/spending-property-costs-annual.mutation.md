# Mutation receipt: spending-property-costs-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-29 against RetireGolden base `0f51ee73` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts`

```diff
diff --git a/packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts b/packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts
index a6117523..e3bba005 100644
--- a/packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts
+++ b/packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts
@@ -51,8 +51,8 @@ export function annualPropertyCarryingCosts(
     if (saleYear !== null && input.year >= saleYear) continue
 
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

The independent review's fixes to D-2027-ROLLOVER moved the lines these receipts quote (the effective property sale year threaded through the property phases, the pre-start events for a sale and a debt payoff, the parameter test seam, and evidence cases added to the restated records); the mutations are unchanged. The baseline is green (annualPropertyCarryingCosts.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts (3 tests | 2 failed) 6ms
   ❯ spending-property-costs-annual — Annual property carrying costs on owned properties (3)
     × inflates both carrying components on Home A and charges nothing in Home B sale year 4ms
     × charges nothing from the start year for a sale dated before it, the year the ledger sells it (restated 2026-09-29) 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts > spending-property-costs-annual — Annual property carrying costs on owned properties > inflates both carrying components on Home A and charges nothing in Home B sale year
AssertionError: Home A carrying cost 4500 is not within {"abs":0.005} of the worksheet's 4620: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts:17:5
     15|     withinTolerance(actual, target, tolerance),
     16|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     17|   ).toBe(true)
       |     ^
     18| }
     19|
 ❯ src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts:78:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts > spending-property-costs-annual — Annual property carrying costs on owned properties > charges nothing from the start year for a sale dated before it, the year the ledger sells it (restated 2026-09-29)
AssertionError: Home A carrying cost 4500 is not within {"abs":0.005} of the worksheet's 4620: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts:17:5
     15|     withinTolerance(actual, target, tolerance),
     16|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     17|   ).toBe(true)
       |     ^
     18| }
     19|
 ❯ src/projection/internal/annualPropertyCarryingCosts.evidence.test.ts:116:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualPropertyCarryingCosts.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
