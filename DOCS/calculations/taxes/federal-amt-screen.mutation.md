# Mutation receipt: federal-amt-screen

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
@@ -443,7 +443,7 @@ function amtExemptionAmount(pack: ParameterPack, filingStatus: FilingStatus, amt
 function amtOrdinaryRateTax(pack: ParameterPack, taxableExcess: number): number {
   if (taxableExcess <= 0) return 0
   const rule = pack.federalTax.amt
-  const firstLayer = Math.min(taxableExcess, rule.rate28StartsAbove) * (rule.rate26Pct / 100)
+  const firstLayer = Math.min(taxableExcess, rule.rate28StartsAbove) * (rule.rate28Pct / 100)
   const secondLayer = Math.max(0, taxableExcess - rule.rate28StartsAbove) * (rule.rate28Pct / 100)
   return firstLayer + secondLayer
 }
```

This charges the 28% rate from the first dollar of AMT taxable excess, so tentative minimum tax becomes $30,772 and AMT $10,772 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/federalTax.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from and the test lines and test counts it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (federalTax.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/tax/federalTax.evidence.test.ts (15 tests | 1 failed) 8ms
   ❯ federal-amt-screen — Federal AMT screen (2)
     × prices AMT at 8,574: 26% of the 109,900 excess over the 90,100 exemption, less 20,000 of regular tax 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/federalTax.evidence.test.ts > federal-amt-screen — Federal AMT screen > prices AMT at 8,574: 26% of the 109,900 excess over the 90,100 exemption, less 20,000 of regular tax
AssertionError: tentativeMinimumTax 30772.000000000004 is not within "exact" of the worksheet's 28574: expected false to be true // Object.is equality

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
 ❯ src/tax/federalTax.evidence.test.ts:147:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/federalTax.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/federalTax.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
