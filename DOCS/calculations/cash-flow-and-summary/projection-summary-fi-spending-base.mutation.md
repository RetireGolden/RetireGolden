# Mutation receipt: projection-summary-fi-spending-base

Executed 2026-09-28 on branch `claude/people-order-and-scenarios` at base `da378d9b` (no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6905169c` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `85e2fdb8` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 6b4a9cfc..07988c94 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -523,3 +523,3 @@
   let pricedYear: ProjectionResult['years'][number] | undefined = targetResult
-  if (targetResult !== undefined && result.years.some(yearConverts)) {
+  if (targetResult !== undefined && result.years.some((year) => year.rothConversionActionExecution !== undefined)) {
     if (options.conversionFreeRun === null) {
```

Treat only a named conversion request as a conversion, so an aggregate strategy's conversion keeps its tax in the FI base, the worksheet's first wrong reading: 110,000 / 1.03^6 / 0.04 = 2,303,081.71 instead of 1,842,465.36, and the published source reads projection. Re-derived for the independent review's M1: the line now asks whether the plan converts in any year, not only the priced one; the mutation is the same reading on the new line.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed because the verification's fixes (N1 to N4) moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (23 tests | 2 failed) 28ms
   ❯ projection-summary-fi-spending-base — Which year and which outflows the FI figures price (3)
     × prices 2032, Robin’s later retirement, from the conversion-free run: 1,842,465.36 6ms
     × keeps the conversion tax only when no conversion-free run is supplied, and says so 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 21 passed (23)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-spending-base — Which year and which outflows the FI figures price > prices 2032, Robin’s later retirement, from the conversion-free run: 1,842,465.36
AssertionError: expected { spendingYear: 2032, …(6) } to deeply equal { spendingYear: 2032, …(6) }

- Expected
+ Received

@@ -2,8 +2,8 @@
    "notRetiring": [],
    "personId": "p2",
    "personLastYearAlive": 2078,
    "retirementRule": "retirementAge",
    "retirementYear": 2032,
-   "spendingSource": "conversionFreeProjection",
+   "spendingSource": "projection",
    "spendingYear": 2032,
  }

 ❯ src/projection/compareSummary.evidence.test.ts:1112:31
    1110|     it('prices 2032, Robin\u2019s later retirement, from the conversio…
    1111|       const summary = summarizeProjection(couple('listed'), converting…
    1112|       expect(summary.fiBasis).toEqual({
       |                               ^
    1113|         spendingYear: fiBaseExpected('Priced year'),
    1114|         spendingSource: fiBaseCell('Spending source'),

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-spending-base — Which year and which outflows the FI figures price > keeps the conversion tax only when no conversion-free run is supplied, and says so
AssertionError: expected 'projection' to be 'conversionTaxIncluded' // Object.is equality

Expected: "conversionTaxIncluded"
Received: "projection"

 ❯ src/projection/compareSummary.evidence.test.ts:1142:46
    1140|       // The worksheet's first wrong reading: (80,000 + 30,000) / 1.03…
    1141|       const summary = summarizeProjection(couple('listed'), converting…
    1142|       expect(summary.fiBasis.spendingSource).toBe('conversionTaxInclud…
       |                                              ^
    1143|       expect(withinTolerance(summary.fiNumber!, 2_303_081.705880049, e…
    1144|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
