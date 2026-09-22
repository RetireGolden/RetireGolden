# Mutation receipt: spending-one-time-goals-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualOneTimeGoalFundingPhase.ts`

```diff
@@ -130,7 +130,7 @@
     } else {
       for (const goal of input.oneTimeGoals) {
         if (goal.year !== year) continue
-        const amount = goal.amount * inflFactor
+        const amount = goal.amount
         oneTimeGoalsFunded += amount
         const classification = goal.classification ?? 'target'
         if (classification === 'required') requiredGoalsFunded += amount
```

This funds each goal at its today-dollar amount rather than the inflated one, publishing $15,000 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualOneTimeGoalFundingPhase.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts (5 tests | 1 failed) 29ms
   ❯ spending-one-time-goals-annual — Annual funded one-time goals (2)
     × funds both 2030 goals at the inflated amount and leaves the 2031 goal out 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)

  Transform  transforming modules took 2.43s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts > spending-one-time-goals-annual — Annual funded one-time goals > funds both 2030 goals at the inflated amount and leaves the 2031 goal out
AssertionError: oneTimeGoalsFunded: actual 15000, worksheet 16500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts:227:9
    225|         withinTolerance(phase.oneTimeGoalsFunded, expected.oneTimeGoal…
    226|         `oneTimeGoalsFunded: actual ${phase.oneTimeGoalsFunded}, works…
    227|       ).toBe(true)
       |         ^
    228|       // The composition really is the two 2030 goals inflated, and no…
    229|       expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualOneTimeGoalFundingPhase.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualOneTimeGoalFundingPhase.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
