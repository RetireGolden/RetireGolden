# Mutation receipt: projection-result-ending-net-worth

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
@@ -2879,7 +2879,7 @@ export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResul
     years,
     depletionYear,
     endingInvestable: last?.investableTotal ?? 0,
-    endingNetWorth: last?.netWorth ?? 0,
+    endingNetWorth: last?.investableTotal ?? 0,
     endingNondeductibleIraBasis,
     warnings: [...warnings],
   }
```

This substitutes ending investable for net worth, publishing $486,375.625 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (simulate.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/simulate.evidence.test.ts (3 tests | 1 failed) 38ms
   ❯ projection-result-ending-net-worth — Projection-result ending net worth (1)
     × republishes the 2031 row and never substitutes ending investable 6ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)

  Transform  transforming modules took 2.13s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/simulate.evidence.test.ts > projection-result-ending-net-worth — Projection-result ending net worth > republishes the 2031 row and never substitutes ending investable
AssertionError: endingNetWorth 486375.625 is not within {"abs":0.005} of the worksheet's 901375.625: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/simulate.evidence.test.ts:33:5
     31|     withinTolerance(actual, target, tolerance),
     32|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     33|   ).toBe(true)
       |     ^
     34| }
     35|
 ❯ src/projection/simulate.evidence.test.ts:256:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/simulate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/simulate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
