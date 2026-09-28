# Mutation receipt: projection-result-ending-investable

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `d9447bec` (branch `claude/aca-2027-coverage-year`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `15478aa9` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `5f917180` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d5fd40c` (branch `claude/social-security-law-2`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `c9e60e7c` (branch `claude/social-security-law-2`, pull request #755), and re-executed 2026-09-27 against RetireGolden base `32763d9d` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `4fde8e43` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1d8256cf` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `719afc7f` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `8de4a471` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1176b2e5` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `dc0c6c3f` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
@@ -2969,7 +2969,7 @@ export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResul
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

the merge of slice 4's final head (slice 3 #754, #755, #756, the claimants split) moved the production lines and test titles these receipts quote The baseline is green (simulate.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine16/packages/engine

 ❯ src/projection/simulate.evidence.test.ts (9 tests | 2 failed) 57ms
   ❯ projection-result-ending-investable — Projection-result ending investable balance (1)
     × republishes the 2031 row and not the 2030 one 8ms
   ❯ projection-result-ending-net-worth — Projection-result ending net worth (1)
     × republishes the 2031 row and never substitutes ending investable 4ms

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
