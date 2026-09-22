# Mutation receipt: federal-ordinary-bracket-tax

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
@@ -326,7 +326,7 @@ function bracketTax(brackets: TaxBracket[], taxable: number): number {
     const lower = brackets[i]!.lowerBound
     const upper = i + 1 < brackets.length ? brackets[i + 1]!.lowerBound : Infinity
     if (taxable <= lower) break
-    tax += (Math.min(taxable, upper) - lower) * (brackets[i]!.ratePct / 100)
+    tax = Math.min(taxable, upper) * (brackets[i]!.ratePct / 100)
   }
   return tax
 }
```

This applies each reached rate to the whole of taxable income and keeps only the last layer, so $60,000 is taxed at a flat 22% for $13,200 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/federalTax.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/federalTax.evidence.test.ts > federal-ordinary-bracket-tax — Federal ordinary bracket tax > layers 1,240 + 4,560 + 2,112 into 7,912 on 60,000 of ordinary taxable income
AssertionError: ordinaryTax 13200 is not within "exact" of the worksheet's 7912: expected false to be true // Object.is equality

FAIL  src/tax/federalTax.evidence.test.ts > federal-ordinary-bracket-tax — Federal ordinary bracket tax > does not apply the top reached rate to every dollar
AssertionError: expected 13200 to be less than 13200
```

## Revert

`git checkout -- packages/engine/src/tax/federalTax.ts`, then `git diff --quiet -- packages/engine/src/tax/federalTax.ts` exited 0, confirming no change to production code after the run.
