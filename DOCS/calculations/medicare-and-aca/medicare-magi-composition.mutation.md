# Mutation receipt: medicare-magi-composition

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `54306786` (branch `claude/mc-provenance-and-seed`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts`

```diff
@@ -1323,8 +1323,7 @@ export function annualFundingApplicationAndClosePhase(
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

Re-executed for the drift check because implementing D-EXAMPLE-SOURCE-SWITCH, D-ACA-CONTRACT-PATHS and D-MC-DEFAULT-SEED moved lines of its production file or its evidence test; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (annualFundingApplicationAndClosePhase.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine17/packages/engine

 ❯ src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts (6 tests | 2 failed) 52ms
   ❯ medicare-magi-composition — Ledger MAGI composition (3)
     × composes the five realized terms into a 51,000 published MAGI 37ms
     × counts tax-exempt interest, which AGI does not 2ms

 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


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
