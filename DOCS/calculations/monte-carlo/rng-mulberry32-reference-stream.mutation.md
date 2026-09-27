# Mutation receipt: rng-mulberry32-reference-stream

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/rng.ts`

```diff
diff --git a/packages/engine/src/montecarlo/rng.ts b/packages/engine/src/montecarlo/rng.ts
index a0cefd29..d24a2e0b 100644
--- a/packages/engine/src/montecarlo/rng.ts
+++ b/packages/engine/src/montecarlo/rng.ts
@@ -22,7 +22,7 @@ export function createRng(seed: number): Rng {
     let t = a
     t = Math.imul(t ^ (t >>> 15), t | 1)
     t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
-    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
+    return ((t ^ (t >>> 14)) >>> 0) / 4294967295
   }
   let spareNormal: number | null = null
   return {
```

Divides by 2^32−1 instead of 2^32, the worksheet's first wrong reading. The recovered integer word is then 2693262068 rather than 2693262067.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/rng.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (rng.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/montecarlo/rng.evidence.test.ts (5 tests | 1 failed) 6ms
   ❯ rng-mulberry32-reference-stream — Mulberry32 uniform reference stream (1)
     × seed 1 yields the worksheet's first five Mulberry32 words 4ms

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

The original bytes of `packages/engine/src/montecarlo/rng.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/rng.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
