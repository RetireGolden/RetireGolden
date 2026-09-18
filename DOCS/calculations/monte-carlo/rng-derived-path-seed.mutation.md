# Mutation receipt: rng-derived-path-seed

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/rng.ts`

```diff
--- a/packages/engine/src/montecarlo/rng.ts
+++ b/packages/engine/src/montecarlo/rng.ts
@@ mutation @@
-return (h ^ (h >>> 15)) >>> 0
+return (seed + pathIndex) >>> 0
```

Replaces the hash with seed+pathIndex=49, the worksheet's first wrong reading.

## Command

```
npx vitest run src/montecarlo/rng.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/rng.evidence.test.ts (4 tests | 3 failed) 6ms
   ❯ rng-derived-path-seed — SplitMix32-style per-path seed (3)
     × hashes (42, 7) to the unsigned word 1351098177 4ms
     × is not seed + pathIndex = 49 0ms
   ❯ rng-mulberry32-reference-stream — Mulberry32 uniform reference stream (1)
     × seed 1 yields the worksheet's first five Mulberry32 uniforms 1ms

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)

(node:43288) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:44592) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/rng.evidence.test.ts > rng-derived-path-seed — SplitMix32-style per-path seed > hashes (42, 7) to the unsigned word 1351098177
AssertionError: expected 49 to be 1351098177 // Object.is equality

- Expected
+ Received

- 1351098177
+ 49

 ❯ src/montecarlo/rng.evidence.test.ts:25:51
     23|
     24|     it('hashes (42, 7) to the unsigned word 1351098177', () => {
     25|       expect(derivePathSeed(baseSeed, pathIndex)).toBe(example.expecte…
       |                                                   ^
     26|     })
     27|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/montecarlo/rng.evidence.test.ts > rng-derived-path-seed — SplitMix32-style per-path seed > is not seed + pathIndex = 49
AssertionError: expected 49 not to be 49 // Object.is equality
 ❯ src/montecarlo/rng.evidence.test.ts:39:55
     37|
     38|     it('is not seed + pathIndex = 49', () => {
     39|       expect(derivePathSeed(baseSeed, pathIndex)).not.toBe(example.exp…
       |                                                       ^
     40|     })
     41|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/montecarlo/rng.evidence.test.ts > rng-mulberry32-reference-stream — Mulberry32 uniform reference stream > seed 1 yields the worksheet's first five Mulberry32 uniforms
AssertionError: uniform[1] 0.002735721180215478 is not within {"abs":0} of the worksheet's 0.00273572118021548: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/rng.evidence.test.ts:73:11
     71|           withinTolerance(draw, value, example.tolerance),
     72|           `uniform[${index}] ${draw} is not within ${JSON.stringify(ex…
     73|         ).toBe(true)
       |           ^
     74|       })
     75|     })
 ❯ src/montecarlo/rng.evidence.test.ts:68:16

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/rng.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/rng.ts` exited 0, confirming no change to production code after the run.
