# Mutation receipt: roth-conversion-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/rothConversion.ts`

```diff
diff --git a/packages/engine/src/strategies/rothConversion.ts b/packages/engine/src/strategies/rothConversion.ts
index fc4ffcd9..312a2740 100644
--- a/packages/engine/src/strategies/rothConversion.ts
+++ b/packages/engine/src/strategies/rothConversion.ts
@@ -128,7 +128,7 @@ function ceilingFor(strategy: FillTarget, input: ConversionSizingInput): number
       const brackets = indexFederalTaxPack(pack, input.inflationScale).federalTax.brackets[filingStatus]
       const i = brackets.findIndex((b) => b.ratePct === strategy.targetValue)
       if (i < 0 || i + 1 >= brackets.length) return null // unknown rate or open-ended top bracket
-      return brackets[i + 1]!.lowerBound
+      return brackets[i]!.lowerBound
     }
     case 'irmaaTier': {
       const tier = strategy.targetValue
```

Read the selected bracket's OWN lower bound as its ceiling — the worksheet's second wrong reading. The 22% bracket starts at $50,400, which is already below the $53,900 of taxable income before any conversion, so the sizing returns already_over_ceiling and the year converts $0 instead of $51,800.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualAggregateRothConversionTargetPlan.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (annualAggregateRothConversionTargetPlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/projection/internal/annualAggregateRothConversionTargetPlan.evidence.test.ts (2 tests | 2 failed) 34ms
   ❯ roth-conversion-annual — Annual Roth conversion: the bracket headroom a fill-to-target strategy converts (2)
     × converts 51800, the 22% bracket headroom above taxable income 30ms
     × sizes the conversion below the no-benefit headroom once benefits are present 3ms

 Test Files  1 failed (1)
      Tests  2 failed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualAggregateRothConversionTargetPlan.evidence.test.ts > roth-conversion-annual — Annual Roth conversion: the bracket headroom a fill-to-target strategy converts > converts 51800, the 22% bracket headroom above taxable income
AssertionError: rothConversion 0 is not within {"abs":0.005} of 51800: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/annualAggregateRothConversionTargetPlan.evidence.test.ts:88:9
     86|         withinTolerance(row.rothConversion, expected.conversion!, exam…
     87|         `rothConversion ${row.rothConversion} is not within ${JSON.str…
     88|       ).toBe(true)
       |         ^
     89|       // ... and the published figure is the bound minus taxable incom…
     90|       expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualAggregateRothConversionTargetPlan.evidence.test.ts > roth-conversion-annual — Annual Roth conversion: the bracket headroom a fill-to-target strategy converts > sizes the conversion below the no-benefit headroom once benefits are present
AssertionError: expected 0 to be greater than 0
 ❯ src/projection/internal/annualAggregateRothConversionTargetPlan.evidence.test.ts:112:34
    110|       })
    111|       expect(row.incomes.socialSecurity).toBeGreaterThan(0)
    112|       expect(row.rothConversion).toBeGreaterThan(0)
       |                                  ^
    113|       expect(row.rothConversion).toBeLessThan(expected.conversion!)
    114|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/strategies/rothConversion.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/strategies/rothConversion.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
