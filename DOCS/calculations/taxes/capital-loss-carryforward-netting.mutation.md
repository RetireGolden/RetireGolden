# Mutation receipt: capital-loss-carryforward-netting

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
@@ -483,7 +483,7 @@ export function applyCapitalLossCarryforward(
   )
   const remaining = availableLoss - usedAgainstOrdinary
   return {
-    ordinaryAfter: ordinary,
+    ordinaryAfter: ordinary - usedAgainstOrdinary,
     netCapitalGain:
       currentGain - usedAgainstGains - usedAgainstOrdinary,
     usedAgainstGains,
```

This subtracts the ordinary-offset slice from ordinary income instead of carrying it on the capital-gain line, so the year publishes ordinary income of $47,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/federalTax.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (federalTax.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/tax/federalTax.evidence.test.ts (13 tests | 2 failed) 7ms
   ❯ capital-loss-carryforward-netting — Capital-loss carryforward netting (2)
     × spends 5,000 of the pool against gains, reports a 3,000 loss on the capital line, and carries 12,000 forward 4ms
     × leaves ordinary income untouched, so the offset is not an ordinary-income deduction 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 11 passed (13)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/federalTax.evidence.test.ts > capital-loss-carryforward-netting — Capital-loss carryforward netting > spends 5,000 of the pool against gains, reports a 3,000 loss on the capital line, and carries 12,000 forward
AssertionError: ordinaryAfter 47000 is not within "exact" of the worksheet's 50000: expected false to be true // Object.is equality

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
 ❯ src/tax/federalTax.evidence.test.ts:78:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/tax/federalTax.evidence.test.ts > capital-loss-carryforward-netting — Capital-loss carryforward netting > leaves ordinary income untouched, so the offset is not an ordinary-income deduction
AssertionError: expected 47000 to be 50000 // Object.is equality

- Expected
+ Received

- 50000
+ 47000

 ❯ src/tax/federalTax.evidence.test.ts:89:37
     87|         pack.federalTax.capitalLossOrdinaryOffsetLimit,
     88|       )
     89|       expect(netting.ordinaryAfter).toBe(inputs.ordinaryIncome)
       |                                     ^
     90|     })
     91|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/federalTax.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/federalTax.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
