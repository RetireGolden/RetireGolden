# Mutation receipt: federal-ordinary-bracket-tax

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (federalTax.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/tax/federalTax.evidence.test.ts (13 tests | 3 failed) 9ms
   ❯ federal-amt-screen — Federal AMT screen (2)
     × prices AMT at 8,574: 26% of the 109,900 excess over the 90,100 exemption, less 20,000 of regular tax 4ms
   ❯ federal-ordinary-bracket-tax — Federal ordinary bracket tax (2)
     × layers 1,240 + 4,560 + 2,112 into 7,912 on 60,000 of ordinary taxable income 1ms
     × does not apply the top reached rate to every dollar 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 10 passed (13)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-amt-screen — Federal AMT screen > prices AMT at 8,574: 26% of the 109,900 excess over the 90,100 exemption, less 20,000 of regular tax
AssertionError: regularTax 27402 is not within "exact" of the worksheet's 20000: expected false to be true // Object.is equality

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
 ❯ src/tax/federalTax.evidence.test.ts:143:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-ordinary-bracket-tax — Federal ordinary bracket tax > layers 1,240 + 4,560 + 2,112 into 7,912 on 60,000 of ordinary taxable income
AssertionError: ordinaryTax 13200 is not within "exact" of the worksheet's 7912: expected false to be true // Object.is equality

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
 ❯ src/tax/federalTax.evidence.test.ts:245:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-ordinary-bracket-tax — Federal ordinary bracket tax > does not apply the top reached rate to every dollar
AssertionError: expected 13200 to be less than 13200
 ❯ src/tax/federalTax.evidence.test.ts:251:34
    249|       const standardBase = standardDeduction(pack, 'single', 0)
    250|       const detail = computeFederalTax(singleFiler({ ordinaryIncome: 6…
    251|       expect(detail.ordinaryTax).toBeLessThan(60_000 * 0.22)
       |                                  ^
    252|     })
    253|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/federalTax.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/federalTax.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
