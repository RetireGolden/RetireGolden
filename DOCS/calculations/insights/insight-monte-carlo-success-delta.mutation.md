# Mutation receipt: monte-carlo-success-rate-comparison

Executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d33ac09` (branch `claude/b2p1-slice3-comparisons`, pull request #754), and re-executed 2026-09-27 against RetireGolden base `e73e5175` (branch `claude/b2p1-slice3-comparisons`, pull request #754) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/stochastic.ts`

```diff
diff --git a/packages/engine/src/decisions/stochastic.ts b/packages/engine/src/decisions/stochastic.ts
index d722d494..9044d2b0 100644
--- a/packages/engine/src/decisions/stochastic.ts
+++ b/packages/engine/src/decisions/stochastic.ts
@@ -90,7 +90,7 @@ export function compareMonteCarloSuccessRates(baseline: MonteCarloRateRun, propo
       `Success rates are compared only from one start year; the baseline starts in ${baseline.startYear} and the proposal in ${proposal.startYear}`,
     )
   }
-  return compareScalars(baseline.successRate, proposal.successRate)
+  return compareScalars(proposal.successRate, baseline.successRate)
 }
 
 /** Each stochastic metric, candidate minus baseline (compareScalars). */
```

Baseline minus proposal, the worksheet's third wrong reading: every green line turns red, and case Y reads -0.036 where the worksheet expects +0.03599999999999992. The attached shared-path deltas, which keep proposal minus baseline, no longer agree with it either.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/stochastic.evidence.test.ts
```

## Captured failing output

The PR #754 follow-up review typed two refusals (MonteCarloComparisonRefusal in the success comparison, InsightPreviewUnavailable in the detectors that find nothing to preview) and added their imports, so the hunk headers are re-pointed. The baseline is green (stochastic.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/decisions/stochastic.evidence.test.ts (4 tests | 3 failed) 3158ms
   ❯ monte-carlo-success-rate-comparison — Monte Carlo success rate change on shared paths (4)
     × cases Y to AC: proposal minus baseline on the same paths, a fraction of paths 4ms
     × case AF: runs from different start years are refused 1ms
     × prices each shared-path entry with its own plan's tax stack when the context has a per-plan builder 3152ms

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/stochastic.evidence.test.ts > monte-carlo-success-rate-comparison — Monte Carlo success rate change on shared paths > cases Y to AC: proposal minus baseline on the same paths, a fraction of paths
AssertionError: caseY: -0.03599999999999992: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/stochastic.evidence.test.ts:90:117
     88|         const c = inputs[key]!
     89|         const comparison = compareMonteCarloSuccessRates(summary(c.bas…
     90|         expect(withinTolerance(comparison.delta, expected[key]!, examp…
       |                                                                                                                     ^
     91|         expect(comparison.baseline).toBe(c.baseline.successes / c.base…
     92|         expect(comparison.proposal).toBe(c.proposal.successes / c.prop…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/decisions/stochastic.evidence.test.ts > monte-carlo-success-rate-comparison — Monte Carlo success rate change on shared paths > case AF: runs from different start years are refused
AssertionError: expected -0.03599999999999992 to be 0.03599999999999992 // Object.is equality

- Expected
+ Received

- 0.03599999999999992
+ -0.03599999999999992

 ❯ src/decisions/stochastic.evidence.test.ts:114:9
    112|       expect(
    113|         compareMonteCarloSuccessRates(summary(c.baseline), summary({ .…
    114|       ).toBe(expected.caseY)
       |         ^
    115|     })
    116|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/decisions/stochastic.evidence.test.ts > monte-carlo-success-rate-comparison — Monte Carlo success rate change on shared paths > prices each shared-path entry with its own plan's tax stack when the context has a per-plan builder
AssertionError: expected -0.020000000000000018 to be 0.020000000000000018 // Object.is equality

- Expected
+ Received

- 0.020000000000000018
+ -0.020000000000000018

 ❯ src/decisions/stochastic.evidence.test.ts:162:43
    160|       expect(shared.endingAfterTaxEstate.percentiles.p50).toBeGreaterT…
    161|       expect(attached.candidate.medianEndingAfterTaxEstate).not.toBe(s…
    162|       expect(attached.deltas.successRate).toBe(
       |                                           ^
    163|         compareMonteCarloSuccessRates({ ...attached.baseline, startYea…
    164|       )

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/stochastic.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/stochastic.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
