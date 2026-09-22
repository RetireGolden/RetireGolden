# Mutation receipt: exact-ledger-summary-comparison

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-twelve` at base `2c07f0d7`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/optimizePlan.ts`

```diff
diff --git a/packages/engine/src/projection/optimizePlan.ts b/packages/engine/src/projection/optimizePlan.ts
index 930a11ac..49baca31 100644
--- a/packages/engine/src/projection/optimizePlan.ts
+++ b/packages/engine/src/projection/optimizePlan.ts
@@ -2229,7 +2229,7 @@ function evaluateExactLedgerScheduleCalculation(
     baseline: evaluation.baselineSummary,
     candidate: evaluation.candidateSummary,
     afterTaxEstateDelta: evaluation.deltas.endingAfterTaxEstate,
-    endingNetWorthDelta: evaluation.deltas.endingNetWorth,
+    endingNetWorthDelta: evaluation.deltas.endingAfterTaxEstate,
     lifetimeTaxDelta: evaluation.deltas.lifetimeTax,
     moneyLastsYearsDelta: evaluation.deltas.moneyLastsYears,
     requestedConversionTotal: execution.requestedTotal,
```

Publish the after-tax-estate difference as the ending-net-worth delta — the worksheet's second wrong reading, `$535,500.25 − $500,000.00 = $35,500.25`.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/optimizePlan.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (17 tests | 1 failed) 299ms
   ❯ exact-ledger-summary-comparison — Exact ledger summary comparison (1)
     × publishes 500000.00 and 535500.25 from their own results and 28250.50 of net worth 12ms

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)

  Transform  transforming modules took 2.53s · 41% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-summary-comparison — Exact ledger summary comparison > publishes 500000.00 and 535500.25 from their own results and 28250.50 of net worth
AssertionError: endingNetWorthDelta: actual 35500.25, worksheet 28250.5: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/optimizePlan.evidence.test.ts:242:9
    240|         withinTolerance(validation.endingNetWorthDelta, expectedDelta,…
    241|         `endingNetWorthDelta: actual ${validation.endingNetWorthDelta}…
    242|       ).toBe(true)
       |         ^
    243|       // The wrong readings the worksheet names: the reversed subtract…
    244|       // after-tax-estate difference standing in for the net-worth del…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/optimizePlan.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/optimizePlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
