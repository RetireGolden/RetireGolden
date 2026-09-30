# Mutation receipt: year-result-employer-match

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-28 against RetireGolden base `1d1cbbb9` (branch `claude/2027-published-figures`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6567821b` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts`

```diff
@@ -766,7 +766,6 @@
     const match415cKey = employerPlanScopeKey(ownerId, account)
     const usedSoFar = addition415cUsed.get(match415cKey) ?? 0
     const remaining415cLimit = Math.max(0, limit415c - usedSoFar)
-    matchVal = Math.min(matchVal, remaining415cLimit)
     if (matchVal <= 0) continue
 
     const balanceBefore = shadowBalances[balanceIndex]!
```

This drops the IRC §415(c) cap on the raw match, publishing $49,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.evidence.test.ts
```

## Captured failing output

Re-executed because merging main (#762, #763) moved the production lines this receipt quotes; the mutation is unchanged. The baseline is green (simulate.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/simulate.evidence.test.ts (9 tests | 1 failed) 117ms
   ❯ year-result-employer-match — Annual employer match under the pay cap and the annual-additions limit (1)
     × caps the 49000 raw match at the 47500 of §415(c) room left after the deferral 12ms

 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/simulate.evidence.test.ts > year-result-employer-match — Annual employer match under the pay cap and the annual-additions limit > caps the 49000 raw match at the 47500 of §415(c) room left after the deferral
AssertionError: employerMatch 49000 is not within {"abs":0.005} of the worksheet's 47500: expected false to be true // Object.is equality

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
 ❯ src/projection/simulate.evidence.test.ts:416:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
