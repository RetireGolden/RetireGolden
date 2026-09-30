# Mutation receipt: bucket-lens-allocation

Executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `7f6fdfc5` (branch `claude/scrub-local-paths`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/bucketLens.ts`

```diff
diff --git a/packages/engine/src/projection/bucketLens.ts b/packages/engine/src/projection/bucketLens.ts
index 3965e8c3..c41d1a96 100644
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

Re-executed after the Codex review of 2026-09-29: the evidence test states the conservation bound that holds and pins a three-span case, which renamed one test and moved the lines this receipt quotes; the mutation is unchanged. The baseline is green (bucketLens.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/bucketLens.evidence.test.ts (5 tests | 3 failed) 8ms
   ❯ bucket-lens-allocation — Bucket view of the investable total (5)
     × five years at spans [2, 8]: each bucket claims the next years of need, capped by what is left 6ms
     × five years at spans [3] 1ms
     × adds to the investable total to within 2 × spans.length units in the last place, not exactly 0ms

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

 ❯ src/projection/bucketLens.evidence.test.ts:67:46
     65|     it('five years at spans [2, 8]: each bucket claims the next years …
     66|       const lens = bucketLens(rows(2026, inputs.needs, inputs.investab…
     67|       expect(lens.map((row) => row.buckets)).toEqual(expected.three)
       |                                              ^
     68|       expect(lens.map((row) => row.need)).toEqual(inputs.needs)
     69|       expect(lens.map((row) => row.investableTotal)).toEqual(inputs.in…

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

 ❯ src/projection/bucketLens.evidence.test.ts:75:46
     73|     it('five years at spans [3]', () => {
     74|       const lens = bucketLens(rows(2026, inputs.needs, inputs.investab…
     75|       expect(lens.map((row) => row.buckets)).toEqual(expected.two)
       |                                              ^
     76|     })
     77|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/bucketLens.evidence.test.ts > bucket-lens-allocation — Bucket view of the investable total > adds to the investable total to within 2 × spans.length units in the last place, not exactly
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

 ❯ src/projection/bucketLens.evidence.test.ts:88:32
     86|       const c = inputs.floatCase
     87|       const lens = bucketLens(rows(2026, c.needs, c.investable), c.spa…
     88|       expect(lens[0]!.buckets).toEqual(expected.floatBuckets)
       |                                ^
     89|       const sum = lens[0]!.buckets.reduce((a, b) => a + b, 0)
     90|       expect(sum).toBe(expected.floatSum)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/bucketLens.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/bucketLens.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
