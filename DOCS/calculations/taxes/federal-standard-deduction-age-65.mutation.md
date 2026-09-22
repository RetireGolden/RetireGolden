# Mutation receipt: federal-standard-deduction-age-65

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/params/index.ts`

```diff
@@ -395,5 +395,5 @@ export function standardDeduction(
 ): number {
   const base = pack.federalTax.standardDeduction[filingStatus]
   const addition = age65StandardDeductionAddition(pack.federalTax.age65Addition, filingStatus, peopleAged65Plus)
-  return base + addition
+  return base + addition * 0
 }
```

This drops the per-person age-65 addition from the composed deduction, publishing $16,100 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/federalTax.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (federalTax.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/tax/federalTax.evidence.test.ts (13 tests | 2 failed) 8ms
   ❯ federal-standard-deduction-age-65 — Federal standard deduction with the age-65 addition (2)
     × composes 16,100 + 1 x 2,050 into an 18,150 standard deduction 3ms
     × is the deduction computeFederalTax elects once the separate senior deduction has phased out 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 11 passed (13)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-standard-deduction-age-65 — Federal standard deduction with the age-65 addition > composes 16,100 + 1 x 2,050 into an 18,150 standard deduction
AssertionError: standardDeduction 16100 is not within "exact" of the worksheet's 18150: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/federalTax.evidence.test.ts:32:5
     30|     withinTolerance(actual, expected, tolerance),
     31|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     32|   ).toBe(true)
       |     ^
     33| }
     34|
 ❯ src/tax/federalTax.evidence.test.ts:280:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-standard-deduction-age-65 — Federal standard deduction with the age-65 addition > is the deduction computeFederalTax elects once the separate senior deduction has phased out
AssertionError: deduction 16100 is not within "exact" of the worksheet's 18150: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/federalTax.evidence.test.ts:32:5
     30|     withinTolerance(actual, expected, tolerance),
     31|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     32|   ).toBe(true)
       |     ^
     33| }
     34|
 ❯ src/tax/federalTax.evidence.test.ts:290:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/params/index.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/params/index.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
