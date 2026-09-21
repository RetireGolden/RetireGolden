# Mutation receipt: projection-summary-lifetime-roth-conversions

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
@@ -103,8 +103,9 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): ProjectionSummary {
   let taxes = 0
   let conversions = 0
   for (const y of result.years) {
     taxes += y.tax + y.penalties
-    conversions += y.rothConversion
+    if (y.rothConversion !== 0) conversions += y.rothConversion
+    else break
   }
```

This stops at the zero-conversion year, dropping 2028 and producing $40,000 — the worksheet's first wrong reading of omitting the zero year by shortening the horizon.

## Command

```
npx vitest run src/projection/compare.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/compare.evidence.test.ts > projection-summary-lifetime-roth-conversions — Lifetime Roth conversions: sum of annual traditional-to-Roth movement > sums $40,000 + $0 + $55,500.25 to $95,500.25 over all three projection rows
AssertionError: lifetimeRothConversions 40000 is not within {"abs":1e-9} of the worksheet's 95500.25: expected false to be true // Object.is equality
 ❯ src/projection/compare.evidence.test.ts:65:9
```

## Revert

`git checkout -- packages/engine/src/projection/compare.ts`, then `git diff --quiet -- packages/engine/src/projection/compare.ts` exited 0, confirming no change to production code after the run.
