# Mutation receipt: federal-ltcg-stacking

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
@@ -396,7 +396,7 @@ function capitalGainsTaxStacked(
   const to = ordinaryTaxable + preferentialIncome
 
   // The layer below t15 is the 0% bracket and contributes no tax.
-  const at15 = Math.max(0, Math.min(to, t20) - Math.max(from, t15))
+  const at15 = Math.max(0, Math.min(to, t20) - from)
   const at20 = Math.max(0, to - Math.max(from, t20))
   return at15 * 0.15 + at20 * 0.2
 }
```

This starts the 15% band at ordinary taxable income instead of at the 15% threshold, taxing all $10,000 of preferential income at 15% for $1,500 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/federalTax.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (federalTax.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/tax/federalTax.evidence.test.ts (13 tests | 2 failed) 8ms
   ❯ federal-ltcg-stacking — Federal long-term capital gain stacking (2)
     × taxes only the 5,550 of preferential income above the 49,450 zero-rate ceiling 3ms
     × charges nothing when every preferential dollar fits under the 15% threshold 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 11 passed (13)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-ltcg-stacking — Federal long-term capital gain stacking > taxes only the 5,550 of preferential income above the 49,450 zero-rate ceiling
AssertionError: capitalGainsTax 1500 is not within {"abs":0.005} of the worksheet's 832.5: expected false to be true // Object.is equality

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
 ❯ src/tax/federalTax.evidence.test.ts:201:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-ltcg-stacking — Federal long-term capital gain stacking > charges nothing when every preferential dollar fits under the 15% threshold
AssertionError: expected 600 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 600

 ❯ src/tax/federalTax.evidence.test.ts:210:38
    208|         singleFiler({ ordinaryIncome: 40_000 + standardBase, capitalGa…
    209|       )
    210|       expect(detail.capitalGainsTax).toBe(0)
       |                                      ^
    211|     })
    212|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/federalTax.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/federalTax.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
