# Mutation receipt: monte-carlo-success-rate-comparison

Executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/stochastic.ts`

```diff
diff --git a/packages/engine/src/decisions/stochastic.ts b/packages/engine/src/decisions/stochastic.ts
index d54dd7d7..a4e0482c 100644
--- a/packages/engine/src/decisions/stochastic.ts
+++ b/packages/engine/src/decisions/stochastic.ts
@@ -56,7 +56,7 @@ export function compareMonteCarloSuccessRates(
       `Success rates are compared only on the same number of paths; the baseline ran ${baseline.pathCount} and the proposal ${proposal.pathCount}`,
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

The baseline is green (stochastic.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine11/packages/engine

 ❯ src/decisions/stochastic.evidence.test.ts (3 tests | 2 failed) 3099ms
   ❯ monte-carlo-success-rate-comparison — Monte Carlo success rate change on shared paths (3)
     × cases Y to AC: proposal minus baseline on the same paths, a fraction of paths 4ms
     × prices each shared-path entry with its own plan's tax stack when the context has a per-plan builder 3094ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/stochastic.evidence.test.ts > monte-carlo-success-rate-comparison — Monte Carlo success rate change on shared paths > cases Y to AC: proposal minus baseline on the same paths, a fraction of paths
AssertionError: caseY: -0.03599999999999992: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/stochastic.evidence.test.ts:85:117
     83|         const c = inputs[key]!
     84|         const comparison = compareMonteCarloSuccessRates(summary(c.bas…
     85|         expect(withinTolerance(comparison.delta, expected[key]!, examp…
       |                                                                                                                     ^
     86|         expect(comparison.baseline).toBe(c.baseline.successes / c.base…
     87|         expect(comparison.proposal).toBe(c.proposal.successes / c.prop…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/decisions/stochastic.evidence.test.ts > monte-carlo-success-rate-comparison — Monte Carlo success rate change on shared paths > prices each shared-path entry with its own plan's tax stack when the context has a per-plan builder
AssertionError: expected -0.020000000000000018 to be 0.020000000000000018 // Object.is equality

- Expected
+ Received

- 0.020000000000000018
+ -0.020000000000000018

 ❯ src/decisions/stochastic.evidence.test.ts:146:43
    144|       expect(shared.endingAfterTaxEstate.percentiles.p50).toBeGreaterT…
    145|       expect(attached.candidate.medianEndingAfterTaxEstate).not.toBe(s…
    146|       expect(attached.deltas.successRate).toBe(
       |                                           ^
    147|         compareMonteCarloSuccessRates(attached.baseline, attached.cand…
    148|       )

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/stochastic.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/stochastic.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
