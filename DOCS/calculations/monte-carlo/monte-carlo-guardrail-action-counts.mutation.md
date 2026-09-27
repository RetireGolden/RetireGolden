# Mutation receipt: monte-carlo-guardrail-action-counts

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-ten` at base `f12eba6d`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
diff --git a/packages/engine/src/montecarlo/run.ts b/packages/engine/src/montecarlo/run.ts
index 67701ffe..8a5113df 100644
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ -558,7 +558,11 @@ export function aggregateMonteCarlo(result: MonteCarloPathsResult, histogramBins
     idealFundingRate: idealIntendedTotal > 0 ? idealFundedTotal / idealIntendedTotal : 1,
     excessFundingRate: excessIntendedTotal > 0 ? excessFundedTotal / excessIntendedTotal : 1,
     flexibleGoals,
-    guardrailActionCounts,
+    guardrailActionCounts: {
+      cut: guardrailActionCounts.cut / paths.length,
+      raise: guardrailActionCounts.raise / paths.length,
+      hold: guardrailActionCounts.hold / paths.length,
+    },
     adjustments,
     downsideRisk: {
       failureRate: share(failingPathCount),
```

Averages each action count across the four paths instead of summing it — the worksheet's first wrong reading. It is written at the return site so the adjustments block, which reads the same per-path records to count paths, is untouched.

## Command

From `packages/engine` (the `npx` and `.cmd` shims do not work in this worktree):

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after merging RetireGolden #751 into B2-P1 slice 2: the drift check #751 adds flagged this receipt against the slice's code (a hunk header naming a line the code has moved from, a context line the slice changed, a header naming no line, or a stated test count the slice's evidence file no longer has), so the diff header, capture, blob hash and revert note are refreshed against this head. The baseline is green (run.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/montecarlo/run.evidence.test.ts (16 tests | 1 failed) 9ms
   ❯ monte-carlo-guardrail-action-counts — Guardrail action counts summed across paths (1)
     × sums cut, raise and hold across the four paths to 6, 3 and 6, the idle path included 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-guardrail-action-counts — Guardrail action counts summed across paths > sums cut, raise and hold across the four paths to 6, 3 and 6, the idle path included
AssertionError: guardrailActionCounts.cut: expected 1.5 to be 6 // Object.is equality

- Expected
+ Received

- 6
+ 1.5

 ❯ src/montecarlo/run.evidence.test.ts:676:90
    674|       const summary = aggregateMonteCarlo(resultOf(startYear, endYear,…
    675|       for (const action of ['cut', 'raise', 'hold'] as const) {
    676|         expect(summary.guardrailActionCounts[action], `guardrailAction…
       |                                                                                          ^
    677|       }
    678|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
