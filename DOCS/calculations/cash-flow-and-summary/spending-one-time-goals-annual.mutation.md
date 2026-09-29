# Mutation receipt: spending-one-time-goals-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-29 against RetireGolden base `aea4dac1` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

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

Decision D-2027-ROLLOVER moved the lines these receipts quote (the per-publisher parameter split and the pre-start warnings in projection/simulate.ts and its annual phases, imports added to evidence files) and restated six of the records; the mutations are unchanged. The baseline is green (annualOneTimeGoalFundingPhase.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/annualOneTimeGoalFundingPhase.evidence.test.ts (7 tests | 1 failed) 37ms
   ❯ spending-one-time-goals-annual — Annual funded one-time goals (2)
     × funds both 2030 goals at the inflated amount and leaves the 2031 goal out 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)

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
