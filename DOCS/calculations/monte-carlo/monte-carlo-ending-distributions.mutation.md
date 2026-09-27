# Mutation receipt: monte-carlo-ending-distributions

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-ten` at base `f12eba6d`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
diff --git a/packages/engine/src/montecarlo/run.ts b/packages/engine/src/montecarlo/run.ts
index 67701ffe..23b22b86 100644
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ -422,7 +422,7 @@ function histogramFor(sorted: number[], histogramBins: number): Histogram {
   const binWidth = max > min ? (max - min) / histogramBins : 1
   const counts = new Array<number>(histogramBins).fill(0)
   for (const v of sorted) {
-    counts[Math.min(histogramBins - 1, Math.floor((v - min) / binWidth))]!++
+    counts[Math.floor((v - min) / binWidth)]!++
   }
   const binCenters = counts.map((_, i) => (max > min ? min + (i + 0.5) * binWidth : min))
   return { min, binWidth, counts, binCenters }
```

Drops the clamp that puts the maximum in the last bin, so `$100` takes its raw index `floor(100 / 25) = 4` and opens a fifth bin — the worksheet's first wrong reading.

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
   ❯ monte-carlo-ending-distributions — Ending investable histogram and ending after-tax estate percentiles (2)
     × bins the ending investable balances into four equal widths, the maximum clamped into the last 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 15 passed (16)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.evidence.test.ts > monte-carlo-ending-distributions — Ending investable histogram and ending after-tax estate percentiles > bins the ending investable balances into four equal widths, the maximum clamped into the last
AssertionError: expected [ 2, 1, +0, 1, NaN ] to deeply equal [ 2, 1, +0, 2 ]

- Expected
+ Received

  [
    2,
    1,
    0,
-   2,
+   1,
+   NaN,
  ]

 ❯ src/montecarlo/run.evidence.test.ts:253:32
    251|         'endingInvestable histogram binWidth',
    252|       )
    253|       expect(histogram.counts).toEqual(expected.histogram.counts)
       |                                ^
    254|     })
    255|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
