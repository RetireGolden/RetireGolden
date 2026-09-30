# Mutation receipt: rng-derived-path-seed

Re-executed 2026-09-18 after the #719 review against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `54306786` (branch `claude/mc-provenance-and-seed`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/rng.ts`

```diff
diff --git a/packages/engine/src/montecarlo/rng.ts b/packages/engine/src/montecarlo/rng.ts
index 05f0e183..e0c5aeb1 100644
--- a/packages/engine/src/montecarlo/rng.ts
+++ b/packages/engine/src/montecarlo/rng.ts
@@ -74,7 +74,7 @@ export function createRng(seed: number): Rng {
  * result is the seed handed to createRng for that path.
  */
 export function derivePathSeed(seed: number, pathIndex: number): number {
-  let h = (seed ^ Math.imul(pathIndex + 1, 0x9e3779b9)) >>> 0
+  let h = (seed ^ Math.imul(pathIndex, 0x9e3779b9)) >>> 0
   h = Math.imul(h ^ (h >>> 16), 0x21f0aaad)
   h = Math.imul(h ^ (h >>> 15), 0x735a2d97)
   return (h ^ (h >>> 15)) >>> 0
```

Uses pathIndex instead of pathIndex + 1, the worksheet's first wrong reading: (42, 7) then yields 640652096 rather than 1351098177.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/montecarlo/rng.evidence.test.ts
```

## Captured failing output

Re-executed for the drift check because implementing D-EXAMPLE-SOURCE-SWITCH, D-ACA-CONTRACT-PATHS and D-MC-DEFAULT-SEED moved lines of its production file or its evidence test; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (rng.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/rng.evidence.test.ts (5 tests | 3 failed) 7ms
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

The original bytes of `packages/engine/src/montecarlo/rng.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/rng.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
