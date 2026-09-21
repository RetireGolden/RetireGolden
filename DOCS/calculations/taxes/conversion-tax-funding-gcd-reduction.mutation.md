# Mutation receipt: conversion-tax-funding-gcd-reduction

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

## Mutation applied to `packages/engine/src/actions/conversionTaxFundingEvidence.ts`

```diff
diff --git a/packages/engine/src/actions/conversionTaxFundingEvidence.ts b/packages/engine/src/actions/conversionTaxFundingEvidence.ts
index 9647d086..70f907a5 100644
--- a/packages/engine/src/actions/conversionTaxFundingEvidence.ts
+++ b/packages/engine/src/actions/conversionTaxFundingEvidence.ts
@@ -378,7 +378,7 @@ function reduceExactCentRational(
 ): ExactCentRational {
   if (numerator === 0n) return { numerator: 0n, denominator: 1n }
   const divisor = greatestCommonDivisor(numerator, denominator)
-  return { numerator: numerator / divisor, denominator: denominator / divisor }
+  return { numerator, denominator }
 }
 
 function exactCentRational(
```

Omit greatest-common-divisor reduction, leaving the exact rational outside canonical lowest terms.

## Command

```
npx.cmd vitest run src/actions/conversionTaxFundingEvidence.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/actions/conversionTaxFundingEvidence.evidence.test.ts (1 test | 1 failed) 5ms
   ❯ conversion-tax-funding-gcd-reduction — Conversion tax funding gcd reduction (1)
     × reduces 150/100 exact cents to the canonical pair 3/2 4ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/actions/conversionTaxFundingEvidence.evidence.test.ts > conversion-tax-funding-gcd-reduction — Conversion tax funding gcd reduction > reduces 150/100 exact cents to the canonical pair 3/2
AssertionError: expected 150 to be 3 // Object.is equality

- Expected
+ Received

- 3
+ 150

 ❯ src/actions/conversionTaxFundingEvidence.evidence.test.ts:13:40
     11|     const amount = reducedConversionTaxFundingExactCentAmount(example.…
     12|     expect(amount).not.toBeNull()
     13|     expect(amount.numeratorMinorUnits).toBe(example.expected.numerator…
       |                                        ^
     14|     expect(amount.denominator).toBe(example.expected.denominator)
     15|   })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/actions/conversionTaxFundingEvidence.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration. The restored named file passed (exit 0).
