# Mutation receipt: withdrawals-by-category-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-27 against RetireGolden base `d9447bec` (branch `claude/aca-2027-coverage-year`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `54306786` (branch `claude/mc-provenance-and-seed`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `5f0bdbda` (branch `claude/2027-rollover`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `d8edbfd2` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts`

```diff
@@ -2028,6 +2028,7 @@ export function annualFundingApplicationAndClosePhase(
       traditional:
         withdrawalPlan.byCategory.traditional +
         rmdTotal +
+        rmdTotal +
         seppTotal +
         inheritedTraditionalForced,
       roth: withdrawalPlan.byCategory.roth + inheritedRothForced,
```

This adds the owner RMD to the traditional category a second time, although the planned draw plus the RMD already is that category: the published traditional becomes $18,759.49 instead of $18,000 — the shape of the worksheet's first wrong reading, sized to this run's own RMD.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts
```

## Captured failing output

The second verification's fixes on this branch (V1 to V4) moved the lines these receipts quote; the mutations are unchanged. The baseline is green (annualFundingApplicationAndClosePhase.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts (6 tests | 3 failed) 44ms
   ❯ withdrawals-total-annual — Annual withdrawal total (1)
     × sums the five categories to 42000 8ms
   ❯ withdrawals-by-category-annual — Annual withdrawals partitioned by source-account category (2)
     × reports each account's draw in its own source category 3ms
     × keeps the RMD inside traditional rather than adding it again 2ms

 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > withdrawals-total-annual — Annual withdrawal total > sums the five categories to 42000
AssertionError: withdrawals.traditional 18759.493670886077 is not within {"abs":0.005} of the worksheet's 18000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:25:5
     23|     withinTolerance(actual, expected, tolerance),
     24|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     25|   ).toBe(true)
       |     ^
     26| }
     27|
 ❯ src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:286:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > withdrawals-by-category-annual — Annual withdrawals partitioned by source-account category > reports each account's draw in its own source category
AssertionError: withdrawals.traditional 18759.493670886077 is not within {"abs":0.005} of the worksheet's 18000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:25:5
     23|     withinTolerance(actual, expected, tolerance),
     24|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     25|   ).toBe(true)
       |     ^
     26| }
     27|
 ❯ src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:341:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts > withdrawals-by-category-annual — Annual withdrawals partitioned by source-account category > keeps the RMD inside traditional rather than adding it again
AssertionError: withdrawals.traditional 18759.493670886077 is not within {"abs":0.005} of the worksheet's 18000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:25:5
     23|     withinTolerance(actual, expected, tolerance),
     24|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     25|   ).toBe(true)
       |     ^
     26| }
     27|
 ❯ src/projection/internal/annualFundingApplicationAndClosePhase.evidence.test.ts:356:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
