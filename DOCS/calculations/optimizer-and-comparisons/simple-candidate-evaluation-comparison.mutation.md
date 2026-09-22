# Mutation receipt: simple-candidate-evaluation-comparison

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-twelve` at base `2c07f0d7`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/evaluateCandidate.ts`

```diff
diff --git a/packages/engine/src/decisions/evaluateCandidate.ts b/packages/engine/src/decisions/evaluateCandidate.ts
index f18d4c86..254c8a50 100644
--- a/packages/engine/src/decisions/evaluateCandidate.ts
+++ b/packages/engine/src/decisions/evaluateCandidate.ts
@@ -587,7 +587,7 @@ export const DECISION_MATERIAL_SHORTFALL_PCT = 0.05
 
 /** Years the money lasts: depletion year, or one past the horizon when it never depletes. */
 export function lastsThroughYear(result: ProjectionResult): number {
-  return result.depletionYear ?? result.endYear + 1
+  return result.depletionYear ?? result.endYear
 }
 
 /** Build a fresh decision context, running the shared baseline once (or reusing a caller's run). */
```

End a never-depleting result at its `endYear` instead of `endYear + 1` — the worksheet's second wrong reading, which gives `2035 − 2034 = 1` year instead of `2`.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/optimizePlan.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (17 tests | 1 failed) 288ms
   ❯ simple-candidate-evaluation-comparison — Simple candidate evaluation comparison (3)
     × sums 20000.75 of candidate conversions and publishes 25250.25, 7500.75 and 2 years 7ms

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)

  Transform  transforming modules took 2.52s · 42% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > simple-candidate-evaluation-comparison — Simple candidate evaluation comparison > sums 20000.75 of candidate conversions and publishes 25250.25, 7500.75 and 2 years
AssertionError: expected 1 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 1

 ❯ src/projection/optimizePlan.evidence.test.ts:581:40
    579|       // against the baseline's 2034 depletion year; using endYear its…
    580|       // worksheet's wrong reading, would publish 1.
    581|       expect(row.moneyLastsYearsDelta).toBe(example.expected.moneyLast…
       |                                        ^
    582|       // The reversed-subtraction wrong readings.
    583|       expect(row.afterTaxEstateDelta).not.toBe(-expectedEstate)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/evaluateCandidate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/evaluateCandidate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
