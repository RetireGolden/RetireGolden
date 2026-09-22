# Mutation receipt: medicare-magi-composition

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualFundingApplicationAndClosePhase.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts (3 tests | 2 failed) 32ms
   ❯ medicare-magi-composition — Ledger MAGI composition (3)
     × composes the five realized terms into a 51,000 published MAGI 28ms
     × counts tax-exempt interest, which AGI does not 2ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > medicare-magi-composition — Ledger MAGI composition > composes the five realized terms into a 51,000 published MAGI
AssertionError: magi 50000 is not within {"abs":0.005} of the worksheet's 51000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:25:5
     23|     withinTolerance(actual, expected, tolerance),
     24|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     25|   ).toBe(true)
       |     ^
     26| }
     27|
 ❯ src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:164:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > medicare-magi-composition — Ledger MAGI composition > counts tax-exempt interest, which AGI does not
AssertionError: magi without the municipal yield 49000 is not within {"abs":0.005} of the worksheet's 50000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:25:5
     23|     withinTolerance(actual, expected, tolerance),
     24|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     25|   ).toBe(true)
       |     ^
     26| }
     27|
 ❯ src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:188:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
