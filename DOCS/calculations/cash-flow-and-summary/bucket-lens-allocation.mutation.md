# Mutation receipt: bucket-lens-allocation

Executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/bucketLens.ts`

```diff
diff --git a/packages/engine/src/projection/bucketLens.ts b/packages/engine/src/projection/bucketLens.ts
index f0746c95..5ed4f50f 100644
--- a/packages/engine/src/projection/bucketLens.ts
+++ b/packages/engine/src/projection/bucketLens.ts
@@ -63,5 +63,5 @@
     let remaining = y.investableTotal
     const buckets: number[] = []
-    let cursor = i
+    let cursor = i + 1
     for (const span of spans) {
       let bucketNeed = 0
```

Starts bucket 1 with next year instead of this year, the worksheet's first wrong reading: year 0's first bucket at spans [2, 8] claims 50,000 instead of 30,000.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/bucketLens.evidence.test.ts
```

## Captured failing output

Executed for B2-P1 slice 2. The baseline is green (bucketLens.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/projection/bucketLens.evidence.test.ts (5 tests | 3 failed) 7ms
   ❯ bucket-lens-allocation — Bucket view of the investable total (5)
     × five years at spans [2, 8]: each bucket claims the next years of need, capped by what is left 5ms
     × five years at spans [3] 1ms
     × adds to the investable total to within one unit in the last place, not exactly 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/bucketLens.evidence.test.ts > bucket-lens-allocation — Bucket view of the investable total > five years at spans [2, 8]: each bucket claims the next years of need, capped by what is left
AssertionError: expected [ [ 50000, 90000, 60000 ], …(4) ] to deeply equal [ [ 30000, 120000, 50000 ], …(4) ]

- Expected
+ Received

  [
    [
-     30000,
-     120000,
      50000,
-   ],
-   [
-     50000,
      90000,
-     10000,
+     60000,
    ],
    [
      70000,
+     50000,
      30000,
-     0,
    ],
    [
-     60000,
+     90000,
      0,
+     10000,
+   ],
+   [
+     50000,
      0,
+     10000,
    ],
    [
-     20000,
      0,
      0,
+     20000,
    ],
  ]

 ❯ src/projection/bucketLens.evidence.test.ts:63:46
     61|     it('five years at spans [2, 8]: each bucket claims the next years …
     62|       const lens = bucketLens(rows(2026, inputs.needs, inputs.investab…
     63|       expect(lens.map((row) => row.buckets)).toEqual(expected.three)
       |                                              ^
     64|       expect(lens.map((row) => row.need)).toEqual(inputs.needs)
     65|       expect(lens.map((row) => row.investableTotal)).toEqual(inputs.in…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/projection/bucketLens.evidence.test.ts > bucket-lens-allocation — Bucket view of the investable total > five years at spans [3]
AssertionError: expected [ [ 90000, 110000 ], …(4) ] to deeply equal [ [ 60000, 140000 ], …(4) ]

- Expected
+ Received

  [
    [
-     60000,
-     140000,
+     90000,
+     110000,
    ],
    [
-     90000,
-     60000,
+     120000,
+     30000,
    ],
    [
-     100000,
-     0,
+     90000,
+     10000,
    ],
    [
-     60000,
-     0,
+     50000,
+     10000,
    ],
    [
+     0,
      20000,
-     0,
    ],
  ]

 ❯ src/projection/bucketLens.evidence.test.ts:71:46
     69|     it('five years at spans [3]', () => {
     70|       const lens = bucketLens(rows(2026, inputs.needs, inputs.investab…
     71|       expect(lens.map((row) => row.buckets)).toEqual(expected.two)
       |                                              ^
     72|     })
     73|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/bucketLens.evidence.test.ts > bucket-lens-allocation — Bucket view of the investable total > adds to the investable total to within one unit in the last place, not exactly
AssertionError: expected [ 2057.21, +0, 97942.79999999999 ] to deeply equal [ 1028.55, 2057.21, 96914.24999999999 ]

- Expected
+ Received

  [
-   1028.55,
    2057.21,
-   96914.24999999999,
+   0,
+   97942.79999999999,
  ]

 ❯ src/projection/bucketLens.evidence.test.ts:82:32
     80|       const c = inputs.floatCase
     81|       const lens = bucketLens(rows(2026, c.needs, c.investable), c.spa…
     82|       expect(lens[0]!.buckets).toEqual(expected.floatBuckets)
       |                                ^
     83|       const sum = lens[0]!.buckets.reduce((a, b) => a + b, 0)
     84|       expect(sum).toBe(expected.floatSum)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/bucketLens.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/bucketLens.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
