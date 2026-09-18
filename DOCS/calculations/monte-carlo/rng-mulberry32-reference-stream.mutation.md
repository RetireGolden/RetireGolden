# Mutation receipt: rng-mulberry32-reference-stream

Re-executed 2026-09-18 after the worksheet re-derivation against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

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

 ❯ src/montecarlo/rng.evidence.test.ts (4 tests | 1 failed) 5ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

   ❯ rng-mulberry32-reference-stream — Mulberry32 uniform reference stream (1)
     × seed 1 yields the worksheet's first five Mulberry32 words 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

 FAIL  src/montecarlo/rng.evidence.test.ts > rng-mulberry32-reference-stream — Mulberry32 uniform reference stream > seed 1 yields the worksheet's first five Mulberry32 words
AssertionError: word[0] 2693262068 is not the worksheet's 2693262067: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/rng.evidence.test.ts:75:11
     73|           withinTolerance(observedWord, word, example.tolerance),
     74|           `word[${index}] ${observedWord} is not the worksheet's ${wor…
     75|         ).toBe(true)
       |           ^
     76|         expect(
     77|           withinTolerance(draw, expectedUniforms[index]!, { rel: 1e-15…
 ❯ src/montecarlo/rng.evidence.test.ts:69:21

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/rng.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/rng.ts` exited 0, confirming no change to production code after the run.
