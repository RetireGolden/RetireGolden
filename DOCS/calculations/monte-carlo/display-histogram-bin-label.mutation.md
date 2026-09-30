# Mutation receipt: monte-carlo-histogram-bin-centres

Executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/run.ts`

```diff
diff --git a/packages/engine/src/montecarlo/run.ts b/packages/engine/src/montecarlo/run.ts
index c12606f1..422b7976 100644
--- a/packages/engine/src/montecarlo/run.ts
+++ b/packages/engine/src/montecarlo/run.ts
@@ -430,5 +430,5 @@
     counts[Math.min(histogramBins - 1, Math.floor((v - min) / binWidth))]!++
   }
-  const binCenters = counts.map((_, i) => (max > min ? min + (i + 0.5) * binWidth : min))
+  const binCenters = counts.map((_, i) => min + (i + 0.5) * binWidth)
   return { min, binWidth, counts, binCenters }
 }
```

Drops the equal-values case and reads the placeholder width as a real one, the page's retired labels: four paths all ending at $0 get centres 0.5, 1.5 and so on to 29.5, which print as $1 to $30.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/run.binCenters.evidence.test.ts
```

## Captured failing output

Re-executed because decisions D-PEOPLE-ORDER and D-FI-CONVERSION-TAX moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (run.binCenters.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/run.binCenters.evidence.test.ts (6 tests | 2 failed) 8ms
   ❯ monte-carlo-histogram-bin-centres — Histogram bin centres (6)
     × case C: every path ends at $0, so every centre is $0, not a made-up scale of $1 to $30 4ms
     × case D: an empty sample has every centre 0 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/run.binCenters.evidence.test.ts > monte-carlo-histogram-bin-centres — Histogram bin centres > case C: every path ends at $0, so every centre is $0, not a made-up scale of $1 to $30
AssertionError: expected Set{ 0.5, 1.5, 2.5, 3.5, 4.5, …(25) } to deeply equal Set{ +0 }

- Expected
+ Received

  Set {
-   0,
+   0.5,
+   1.5,
+   10.5,
+   11.5,
+   12.5,
+   13.5,
+   14.5,
+   15.5,
+   16.5,
+   17.5,
+   18.5,
+   19.5,
+   2.5,
+   20.5,
+   21.5,
+   22.5,
+   23.5,
+   24.5,
+   25.5,
+   26.5,
+   27.5,
+   28.5,
+   29.5,
+   3.5,
+   4.5,
+   5.5,
+   6.5,
+   7.5,
+   8.5,
+   9.5,
  }

 ❯ src/montecarlo/run.binCenters.evidence.test.ts:94:37
     92|       const e = expected.caseC!
     93|       expect(h.counts[0]).toBe(e.count)
     94|       expect(new Set(h.binCenters)).toEqual(new Set([e.centre]))
       |                                     ^
     95|       // The page used to label bar i with min + (i + 0.5) × the place…
     96|       const retired = h.counts.map((_, i) => h.min + (i + 0.5) * h.bin…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/montecarlo/run.binCenters.evidence.test.ts > monte-carlo-histogram-bin-centres — Histogram bin centres > case D: an empty sample has every centre 0
AssertionError: expected Set{ 0.5, 1.5, 2.5, 3.5, 4.5, …(25) } to deeply equal Set{ +0 }

- Expected
+ Received

  Set {
-   0,
+   0.5,
+   1.5,
+   10.5,
+   11.5,
+   12.5,
+   13.5,
+   14.5,
+   15.5,
+   16.5,
+   17.5,
+   18.5,
+   19.5,
+   2.5,
+   20.5,
+   21.5,
+   22.5,
+   23.5,
+   24.5,
+   25.5,
+   26.5,
+   27.5,
+   28.5,
+   29.5,
+   3.5,
+   4.5,
+   5.5,
+   6.5,
+   7.5,
+   8.5,
+   9.5,
  }

 ❯ src/montecarlo/run.binCenters.evidence.test.ts:102:37
    100|     it('case D: an empty sample has every centre 0', () => {
    101|       const h = histogramOf(inputs.caseD!)
    102|       expect(new Set(h.binCenters)).toEqual(new Set([expected.caseD!.c…
       |                                     ^
    103|     })
    104|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/run.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/run.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
