# Mutation receipt: projection-result-ending-investable

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `d9447bec` (branch `claude/aca-2027-coverage-year`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
@@ -2894,7 +2894,7 @@ export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResul
     endYear,
     years,
     depletionYear,
-    endingInvestable: last?.investableTotal ?? 0,
+    endingInvestable: years[0]?.investableTotal ?? 0,
     endingNetWorth: last?.netWorth ?? 0,
     endingNondeductibleIraBasis,
     warnings: [...warnings],
```

This copies the first year row instead of the last, publishing $510,000 — the worksheet's first wrong reading. The ending-net-worth fixture in the same file fails alongside, because it reads the gap between the two terminal fields.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 for the review of decision D-ACA-2027-TABLE: the capture was stale on main (simulate.evidence.test.ts grew from 3 to 9 tests and its stack lines moved) and simulate.ts has moved since, so the hunk header was recomputed from the current file and the capture, blob hash and revert note are refreshed against this head. The baseline is green (simulate.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine7/packages/engine

 ❯ src/projection/simulate.evidence.test.ts (9 tests | 2 failed) 52ms
   ❯ projection-result-ending-investable — Projection-result ending investable balance (1)
     × republishes the 2031 row and not the 2030 one 7ms
   ❯ projection-result-ending-net-worth — Projection-result ending net worth (1)
     × republishes the 2031 row and never substitutes ending investable 3ms

 Test Files  1 failed (1)
      Tests  2 failed | 7 passed (9)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/simulate.evidence.test.ts > projection-result-ending-investable — Projection-result ending investable balance > republishes the 2031 row and not the 2030 one
AssertionError: endingInvestable 510000 is not within {"abs":0.005} of the worksheet's 487250.125: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/simulate.evidence.test.ts:35:5
     33|     withinTolerance(actual, target, tolerance),
     34|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     35|   ).toBe(true)
       |     ^
     36| }
     37|
 ❯ src/projection/simulate.evidence.test.ts:212:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/simulate.evidence.test.ts > projection-result-ending-net-worth — Projection-result ending net worth > republishes the 2031 row and never substitutes ending investable
AssertionError: net worth above ending investable 391375.625 is not within {"abs":0.005} of the worksheet's 415000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/simulate.evidence.test.ts:35:5
     33|     withinTolerance(actual, target, tolerance),
     34|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     35|   ).toBe(true)
       |     ^
     36| }
     37|
 ❯ src/projection/simulate.evidence.test.ts:263:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/simulate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/simulate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
