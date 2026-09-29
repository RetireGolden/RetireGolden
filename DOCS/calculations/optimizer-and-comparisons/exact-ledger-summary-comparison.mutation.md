# Mutation receipt: exact-ledger-summary-comparison

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-twelve` at base `2c07f0d7`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d33ac09` (branch `claude/b2p1-slice3-comparisons`, pull request #754), and re-executed 2026-09-28 against RetireGolden base `1176b2e5` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `dc0c6c3f` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `61ceb34a` (branch `claude/mc-provenance-and-seed`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `04218ee3` (branch `claude/2027-published-figures`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `5f0bdbda` (branch `claude/2027-rollover`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `d8edbfd2` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/optimizePlan.ts`

```diff
diff --git a/packages/engine/src/projection/optimizePlan.ts b/packages/engine/src/projection/optimizePlan.ts
index 4dc447d3..1159719d 100644
--- a/packages/engine/src/projection/optimizePlan.ts
+++ b/packages/engine/src/projection/optimizePlan.ts
@@ -2343,7 +2343,7 @@ function evaluateExactLedgerScheduleCalculation(
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

The second verification's fixes on this branch (V1 to V4) moved the lines these receipts quote; the mutations are unchanged. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine21/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (23 tests | 1 failed) 878ms
   ❯ exact-ledger-summary-comparison — Full projection summary comparison (1)
     × publishes 500000.00 and 535500.25 from their own results and 28250.50 of net worth 14ms

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-summary-comparison — Full projection summary comparison > publishes 500000.00 and 535500.25 from their own results and 28250.50 of net worth
AssertionError: endingNetWorthDelta: actual 35500.25, worksheet 28250.5: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/optimizePlan.evidence.test.ts:243:9
    241|         withinTolerance(validation.endingNetWorthDelta, expectedDelta,…
    242|         `endingNetWorthDelta: actual ${validation.endingNetWorthDelta}…
    243|       ).toBe(true)
       |         ^
    244|       // The wrong readings the worksheet names: the reversed subtract…
    245|       // after-tax-estate difference standing in for the net-worth del…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/optimizePlan.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/optimizePlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
