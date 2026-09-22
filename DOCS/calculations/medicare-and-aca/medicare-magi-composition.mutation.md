# Mutation receipt: medicare-magi-composition

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts`

```diff
@@ -1325,8 +1325,7 @@ export function annualFundingApplicationAndClosePhase(
         ordinaryRealized +
           gainsRealized +
           incomes.qualifiedDividends +
-          taxableSs +
-          yearTaxExemptInterest,
+          taxableSs,
       ),
     )
 
```

This drops tax-exempt interest from the five-term composition, publishing $50,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts
```

## Captured failing output

```
FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > medicare-magi-composition — Ledger MAGI composition > composes the five realized terms into a 51,000 published MAGI
AssertionError: magi 50000 is not within {"abs":0.005} of the worksheet's 51000: expected false to be true // Object.is equality

FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > medicare-magi-composition — Ledger MAGI composition > counts tax-exempt interest, which AGI does not
AssertionError: magi without the municipal yield 49000 is not within {"abs":0.005} of the worksheet's 50000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts` exited 0, confirming no change to production code after the run.
