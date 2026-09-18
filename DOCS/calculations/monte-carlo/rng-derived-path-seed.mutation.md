# Mutation receipt: rng-derived-path-seed

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/rng.ts`

```diff
--- a/packages/engine/src/montecarlo/rng.ts
+++ b/packages/engine/src/montecarlo/rng.ts
@@ mutation @@
-let h = (seed ^ Math.imul(pathIndex + 1, 0x9e3779b9)) >>> 0
+let h = (seed ^ Math.imul(pathIndex, 0x9e3779b9)) >>> 0
```

Uses pathIndex instead of pathIndex + 1, the worksheet's first wrong reading: (42, 7) then yields 640652096 rather than 1351098177.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/rng.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/montecarlo/rng.evidence.test.ts (5 tests | 3 failed) 6ms
   ❯ rng-derived-path-seed — SplitMix32-style per-path seed (4)
     × hashes (42, 7) to 1351098177 4ms
     × hashes (42, 8) to 2450979136 0ms
     × hashes (1, 0) to 3950124170 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/rng.evidence.test.ts > rng-derived-path-seed — SplitMix32-style per-path seed > hashes (42, 7) to 1351098177
AssertionError: expected 640652096 to be 1351098177 // Object.is equality

- Expected
+ Received

- 1351098177
+ 640652096

 ❯ src/montecarlo/rng.evidence.test.ts:27:71
     25|
     26|     it('hashes (42, 7) to 1351098177', () => {
     27|       expect(derivePathSeed(cases[0]!.baseSeed, cases[0]!.pathIndex)).…
       |                                                                       ^
     28|     })
     29|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/montecarlo/rng.evidence.test.ts > rng-derived-path-seed — SplitMix32-style per-path seed > hashes (42, 8) to 2450979136
AssertionError: expected 1351098177 to be 2450979136 // Object.is equality

- Expected
+ Received

- 2450979136
+ 1351098177

 ❯ src/montecarlo/rng.evidence.test.ts:31:71
     29|
     30|     it('hashes (42, 8) to 2450979136', () => {
     31|       expect(derivePathSeed(cases[1]!.baseSeed, cases[1]!.pathIndex)).…
       |                                                                       ^
     32|     })
     33|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/montecarlo/rng.evidence.test.ts > rng-derived-path-seed — SplitMix32-style per-path seed > hashes (1, 0) to 3950124170
AssertionError: expected 2261973619 to be 3950124170 // Object.is equality

- Expected
+ Received

- 3950124170
+ 2261973619

 ❯ src/montecarlo/rng.evidence.test.ts:35:71
     33|
     34|     it('hashes (1, 0) to 3950124170', () => {
     35|       expect(derivePathSeed(cases[2]!.baseSeed, cases[2]!.pathIndex)).…
       |                                                                       ^
     36|     })
     37|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

`git checkout -- packages/engine/src/montecarlo/rng.ts`, then `git diff --quiet -- packages/engine/src/montecarlo/rng.ts` exited 0, confirming no change to production code after the run.
