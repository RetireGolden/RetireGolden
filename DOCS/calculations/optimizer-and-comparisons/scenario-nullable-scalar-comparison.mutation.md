# Mutation receipt: scenario-nullable-scalar-comparison

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-26 against RetireGolden base `5d3a72b1` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/scenarios/comparison.ts`

```diff
diff --git a/packages/engine/src/scenarios/comparison.ts b/packages/engine/src/scenarios/comparison.ts
index 85415a4c..63e72503 100644
--- a/packages/engine/src/scenarios/comparison.ts
+++ b/packages/engine/src/scenarios/comparison.ts
@@ -324,7 +324,7 @@ function nullableScalar(baseline: number | null, proposal: number | null): Nulla
     return {
       baseline: baseline === null ? null : safeNumber(baseline),
       proposal: proposal === null ? null : safeNumber(proposal),
-      delta: null,
+      delta: safeNumber((proposal ?? 0) - (baseline ?? 0)),
     }
   }
   return scalar(baseline, proposal)
```

Coerce an absent operand to zero instead of publishing a null delta.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/scenarios/comparisonCells.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-26 on branch claude/solver-answers-unpriced-aca after the unpriced-ACA, answer-direction and required-floor change to the spending solver, the scenario capacity comparison and the spending-headroom Insight moved lines of the production file, so the capture, blob hashes and revert note are refreshed against this head. The baseline is green (comparisonCells.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine5/packages/engine

 ❯ src/scenarios/comparisonCells.evidence.test.ts (4 tests | 1 failed) 64ms
   ❯ scenario-nullable-scalar-comparison — Scenario nullable scalar comparison (2)
     × publishes a null delta when the baseline never depletes 12ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/scenarios/comparisonCells.evidence.test.ts > scenario-nullable-scalar-comparison — Scenario nullable scalar comparison > publishes a null delta when the baseline never depletes
AssertionError: expected 2044 to be null // Object.is equality

- Expected:
null

+ Received:
2044

 ❯ src/scenarios/comparisonCells.evidence.test.ts:260:26
    258|       expect(cell.baseline).toBe(absent.baseline)
    259|       expect(cell.proposal).toBe(absent.proposal)
    260|       expect(cell.delta).toBe(example.expected.absentDelta)
       |                          ^
    261|       // Coercing the absent operand to zero would present the proposa…
    262|       // itself as a comparison.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/scenarios/comparison.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/scenarios/comparison.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
