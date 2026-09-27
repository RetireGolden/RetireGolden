# Mutation receipt: solved-spending-rounding

Executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/spendingSolver.ts`

```diff
diff --git a/packages/engine/src/decisions/spendingSolver.ts b/packages/engine/src/decisions/spendingSolver.ts
index 6d174d4d..5ff00422 100644
--- a/packages/engine/src/decisions/spendingSolver.ts
+++ b/packages/engine/src/decisions/spendingSolver.ts
@@ -223,5 +223,5 @@
     throw new RangeError(`A solved spending amount must be a finite number of dollars at or above 0; got ${amount}.`)
   }
-  return Math.floor(amount / SOLVED_SPENDING_STEP_DOLLARS) * SOLVED_SPENDING_STEP_DOLLARS
+  return Math.round(amount / SOLVED_SPENDING_STEP_DOLLARS) * SOLVED_SPENDING_STEP_DOLLARS
 }
 
```

Rounds to the nearest $100 instead of down, the worksheet's first wrong reading: case C's passing level of $45,099 publishes $45,100, a level above the one that passed and never shown to pass.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/spendingSolver.rounding.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after the independent review of B2-P1 slice 2 changed this receipt's evidence file or moved the lines it mutates, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (spendingSolver.rounding.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/decisions/spendingSolver.rounding.evidence.test.ts (10 tests | 2 failed) 137ms
   ❯ solved-spending-rounding — Sustainable spending rounded down to the hundred (10)
     × cases B to G: the floor of the passing probe, and the slack measured from it 3ms
     × case J: a rounded amount below the required spending floor is never published 8ms

 Test Files  1 failed (1)
      Tests  2 failed | 8 passed (10)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/spendingSolver.rounding.evidence.test.ts > solved-spending-rounding — Sustainable spending rounded down to the hundred > cases B to G: the floor of the passing probe, and the slack measured from it
AssertionError: caseC: expected 45100 to be 45000 // Object.is equality

- Expected
+ Received

- 45000
+ 45100

 ❯ src/decisions/spendingSolver.rounding.evidence.test.ts:144:32
    142|         const e = expected[key]!
    143|         const published = roundSolvedSpending(c.feasibleBaseAnnual!)
    144|         expect(published, key).toBe(e.maxBaseAnnual)
       |                                ^
    145|         near(published - c.currentBaseAnnual, e.spendingSlackDollars a…
    146|       }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/decisions/spendingSolver.rounding.evidence.test.ts > solved-spending-rounding — Sustainable spending rounded down to the hundred > case J: a rounded amount below the required spending floor is never published
AssertionError: expected 40100 to be 40060 // Object.is equality

- Expected
+ Received

- 40060
+ 40100

 ❯ src/decisions/spendingSolver.rounding.evidence.test.ts:230:36
    228|       })
    229|       const e = expected.caseJ!
    230|       expect(result.maxBaseAnnual).toBe(e.maxBaseAnnual)
       |                                    ^
    231|       expect(result.feasibleBaseAnnual).toBe(e.feasibleBaseAnnual)
    232|       expect(result.spendingSlackDollars).toBe(e.spendingSlackDollars)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/spendingSolver.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/spendingSolver.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
