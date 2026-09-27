# Mutation receipt: scenario-nullable-scalar-comparison

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-26 against RetireGolden base `5d3a72b1` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c780ae5` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `a1fd6d59` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d33ac09` (branch `claude/b2p1-slice3-comparisons`, pull request #754) in `packages/engine`.

## Mutation applied to `packages/engine/src/scenarios/scalarComparison.ts`

```diff
diff --git a/packages/engine/src/scenarios/scalarComparison.ts b/packages/engine/src/scenarios/scalarComparison.ts
index 1a212327..3051eb12 100644
--- a/packages/engine/src/scenarios/scalarComparison.ts
+++ b/packages/engine/src/scenarios/scalarComparison.ts
@@ -75,7 +75,7 @@ export function compareNullableScalars(baseline: number | null, proposal: number
     return {
       baseline: baseline === null ? null : finiteComparand(baseline, 'baseline'),
       proposal: proposal === null ? null : finiteComparand(proposal, 'proposal'),
-      delta: null,
+      delta: finiteComparand((proposal ?? 0) - (baseline ?? 0), 'difference'),
     }
   }
   return compareScalars(baseline, proposal)
```

Coerce an absent operand to zero instead of publishing a null delta. Until B2-P1 slice 3 this was the same change to the private `nullableScalar` helper of `packages/engine/src/scenarios/comparison.ts`; the helper moved, unchanged in its arithmetic, to `scenarios/scalarComparison.ts` as the exported `compareNullableScalars`, so the mutation now applies there.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/scenarios/comparisonCells.evidence.test.ts
```

## Captured failing output

The PR #754 review fixes changed these production files (the dollar basis built once, typed comparison refusals, the start-year refusal, the engine's material-shortfall flag, the per-candidate stochastic refusal) and one evidence file, so the hunk headers, quoted lines and test counts are re-pointed. The baseline is green (comparisonCells.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine11/packages/engine

 ❯ src/scenarios/comparisonCells.evidence.test.ts (6 tests | 2 failed) 68ms
   ❯ scenario-nullable-scalar-comparison — Scenario nullable scalar comparison (3)
     × publishes a null delta when the baseline never depletes 12ms
     × publishes the same cells from the exported helper, and refuses a non-finite present value 2ms

 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/scenarios/comparisonCells.evidence.test.ts > scenario-nullable-scalar-comparison — Scenario nullable scalar comparison > publishes a null delta when the baseline never depletes
AssertionError: expected 2044 to be null // Object.is equality

- Expected:
null

+ Received:
2044

 ❯ src/scenarios/comparisonCells.evidence.test.ts:274:26
    272|       expect(cell.baseline).toBe(absent.baseline)
    273|       expect(cell.proposal).toBe(absent.proposal)
    274|       expect(cell.delta).toBe(example.expected.absentDelta)
       |                          ^
    275|       // Coercing the absent operand to zero would present the proposa…
    276|       // itself as a comparison.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/scenarios/comparisonCells.evidence.test.ts > scenario-nullable-scalar-comparison — Scenario nullable scalar comparison > publishes the same cells from the exported helper, and refuses a non-finite present value
AssertionError: expected { Object (baseline, proposal, ...) } to deeply equal { Object (baseline, proposal, ...) }

- Expected
+ Received

  {
    "baseline": null,
-   "delta": null,
+   "delta": 2044,
    "proposal": 2044,
  }

 ❯ src/scenarios/comparisonCells.evidence.test.ts:286:72
    284|         delta: example.expected.presentDelta,
    285|       })
    286|       expect(compareNullableScalars(absent.baseline, absent.proposal))…
       |                                                                        ^
    287|         baseline: absent.baseline,
    288|         proposal: absent.proposal,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/scenarios/scalarComparison.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/scenarios/scalarComparison.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
