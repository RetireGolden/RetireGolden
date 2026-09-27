# Mutation receipt: federal-ltcg-stacking

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
@@ -428,7 +428,7 @@ function capitalGainsTaxStacked(
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

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from and the test lines and test counts it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (federalTax.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/tax/federalTax.evidence.test.ts (15 tests | 2 failed) 8ms
   ❯ federal-ltcg-stacking — Federal long-term capital gain stacking (2)
     × taxes only the 5,550 of preferential income above the 49,450 zero-rate ceiling 4ms
     × charges nothing when every preferential dollar fits under the 15% threshold 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 13 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-ltcg-stacking — Federal long-term capital gain stacking > taxes only the 5,550 of preferential income above the 49,450 zero-rate ceiling
AssertionError: capitalGainsTax 1500 is not within {"abs":0.005} of the worksheet's 832.5: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/federalTax.evidence.test.ts:33:5
     31|     withinTolerance(actual, expected, tolerance),
     32|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     33|   ).toBe(true)
       |     ^
     34| }
     35|
 ❯ src/tax/federalTax.evidence.test.ts:202:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-ltcg-stacking — Federal long-term capital gain stacking > charges nothing when every preferential dollar fits under the 15% threshold
AssertionError: expected 600 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 600

 ❯ src/tax/federalTax.evidence.test.ts:211:38
    209|         singleFiler({ ordinaryIncome: 40_000 + standardBase, capitalGa…
    210|       )
    211|       expect(detail.capitalGainsTax).toBe(0)
       |                                      ^
    212|     })
    213|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/federalTax.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/federalTax.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
