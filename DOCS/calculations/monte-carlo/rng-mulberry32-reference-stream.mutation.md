# Mutation receipt: rng-mulberry32-reference-stream

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/rng.ts`

```diff
--- a/packages/engine/src/montecarlo/rng.ts
+++ b/packages/engine/src/montecarlo/rng.ts
@@ mutation @@
-    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
+    return ((t ^ (t >>> 14)) >>> 0) / 4294967295
```

Divides by 2^32−1 instead of 2^32, the worksheet's first wrong reading. The recovered integer word is then 2693262068 rather than 2693262067.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/rng.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/rng.evidence.test.ts (5 tests | 1 failed) 5ms
   ❯ rng-mulberry32-reference-stream — Mulberry32 uniform reference stream (1)
     × seed 1 yields the worksheet's first five Mulberry32 words 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/rng.evidence.test.ts > rng-mulberry32-reference-stream — Mulberry32 uniform reference stream > seed 1 yields the worksheet's first five Mulberry32 words
AssertionError: word[0] 2693262068 is not the worksheet's 2693262067: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/rng.evidence.test.ts:79:11
     77|           withinTolerance(observedWord, word, example.tolerance),
     78|           `word[${index}] ${observedWord} is not the worksheet's ${wor…
     79|         ).toBe(true)
       |           ^
     80|         expect(
     81|           withinTolerance(draw, expectedUniforms[index]!, { rel: 1e-15…
 ❯ src/montecarlo/rng.evidence.test.ts:73:21

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/rng.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/rng.ts` exited 0, confirming no change to production code after the run.
