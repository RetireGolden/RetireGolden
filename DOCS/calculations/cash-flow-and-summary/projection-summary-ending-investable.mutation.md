# Mutation receipt: projection-summary-ending-investable

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `94954596` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6905169c` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `85e2fdb8` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 6b4a9cfc..f605cc9b 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -561,7 +561,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): Proje
   return {
     lifetimeTaxesAndPenalties: taxes,
     lifetimeRothConversions: conversions,
-    endingInvestable: result.endingInvestable,
+    endingInvestable: result.years[result.years.length - 2]?.investableTotal ?? result.endingInvestable,
     endingNetWorth: result.endingNetWorth,
     // What heirs receive: net worth less heir tax and less any charitable
     // bequests (charity leaves the heirs' estate but is never taxed). With no
```

Select the penultimate annual investable balance instead of the whole-run endpoint.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed because the verification's fixes (N1 to N4) moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (23 tests | 1 failed) 24ms
   ❯ projection-summary-ending-investable — Projection summary ending investable (1)
     × republishes the 438765.43 endpoint and not the 472000.00 penultimate balance 12ms

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-ending-investable — Projection summary ending investable > republishes the 438765.43 endpoint and not the 472000.00 penultimate balance
AssertionError: endingInvestable: actual 472000, worksheet 438765.43: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:171:9
    169|         withinTolerance(summary.endingInvestable, expected, example.to…
    170|         `endingInvestable: actual ${summary.endingInvestable}, workshe…
    171|       ).toBe(true)
       |         ^
    172|       // The wrong readings the worksheet names: the penultimate balan…
    173|       // the endpoint added to it.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
