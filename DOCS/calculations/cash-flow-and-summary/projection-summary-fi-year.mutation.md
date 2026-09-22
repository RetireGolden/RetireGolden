# Mutation receipt: projection-summary-fi-year

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
@@ -345,7 +345,7 @@
   let fiAge: number | null = null
   for (const y of result.years) {
     const deflatedInvestable = y.investableTotal / Math.pow(1 + inflationRate, y.year - startYear)
-    if (deflatedInvestable >= fiNumber) {
+    if (deflatedInvestable > fiNumber) {
       fiYear = y.year
       fiAge = y.year - birthYear
       break
```

This makes the crossing comparison strict, so the first crossing moves from 2027 to 2028 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-year — First financial-independence crossing year > crosses inclusively in 2027 and never waits for the larger 2028 row
AssertionError: expected 2028 to be 2027 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/compare.ts`, then `git diff --quiet -- packages/engine/src/projection/compare.ts` exited 0, confirming no change to production code after the run.
