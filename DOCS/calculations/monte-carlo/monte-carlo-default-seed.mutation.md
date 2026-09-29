# Mutation receipt: monte-carlo-default-seed

Executed 2026-09-28 against RetireGolden base `54306786` (branch `claude/mc-provenance-and-seed`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/rng.ts`

```diff
diff --git a/packages/engine/src/montecarlo/rng.ts b/packages/engine/src/montecarlo/rng.ts
index 05f0e183..9e97202a 100644
--- a/packages/engine/src/montecarlo/rng.ts
+++ b/packages/engine/src/montecarlo/rng.ts
@@ -21,3 +21,3 @@
  */
-export const DEFAULT_MONTE_CARLO_SEED = 0x5eeded
+export const DEFAULT_MONTE_CARLO_SEED = 0x5eedee
 
```

Change the default seed by one bit pattern (0x5eedee = 6,221,294), as a seed chosen after looking at outcomes, or taken from a plan's id, would. Every path seed moves, so the evidence fails on the seed itself and on the path seeds the worksheet derives by hand.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/headline.evidence.test.ts
```

## Captured failing output

Executed for the first time with its record (decisions D-EXAMPLE-SOURCE-SWITCH, D-ACA-CONTRACT-PATHS and D-MC-DEFAULT-SEED). The baseline is green (headline.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine17/packages/engine

 ❯ src/montecarlo/headline.evidence.test.ts (2 tests | 2 failed) 8ms
   ❯ monte-carlo-default-seed — Default Monte Carlo seed and the headline run's options (2)
     × is 6,221,293, and seeds paths 0 and 1 as the worksheet derives 5ms
     × publishes the headline options on it, the same for a plan under any id 2ms

 Test Files  1 failed (1)
      Tests  2 failed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/headline.evidence.test.ts > monte-carlo-default-seed — Default Monte Carlo seed and the headline run's options > is 6,221,293, and seeds paths 0 and 1 as the worksheet derives
AssertionError: expected 6221294 to be 6221293 // Object.is equality

- Expected
+ Received

- 6221293
+ 6221294

 ❯ src/montecarlo/headline.evidence.test.ts:29:40
     27|   () => {
     28|     it('is 6,221,293, and seeds paths 0 and 1 as the worksheet derives…
     29|       expect(DEFAULT_MONTE_CARLO_SEED).toBe(expected('DEFAULT_MONTE_CA…
       |                                        ^
     30|       expect(derivePathSeed(DEFAULT_MONTE_CARLO_SEED, 0)).toBe(expecte…
     31|       expect(derivePathSeed(DEFAULT_MONTE_CARLO_SEED, 1)).toBe(expecte…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/montecarlo/headline.evidence.test.ts > monte-carlo-default-seed — Default Monte Carlo seed and the headline run's options > publishes the headline options on it, the same for a plan under any id
AssertionError: expected { startYear: 2026, …(3) } to strictly equal { startYear: 2026, …(3) }

- Expected
+ Received

@@ -3,8 +3,8 @@
      "inflationMeanPct": 2.5,
      "returnVolPct": 12,
      "type": "lognormal",
    },
    "pathCount": 1000,
-   "seed": 6221293,
+   "seed": 6221294,
    "startYear": 2026,
  }

 ❯ src/montecarlo/headline.evidence.test.ts:42:23
     40|       expect(HEADLINE_MONTE_CARLO_RETURN_VOL_PCT).toBe(expected('Headl…
     41|       const options = headlineMonteCarloOptions(plan, 2026)
     42|       expect(options).toStrictEqual({
       |                       ^
     43|         startYear: 2026,
     44|         pathCount: expected('Headline path count'),

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/rng.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/rng.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
