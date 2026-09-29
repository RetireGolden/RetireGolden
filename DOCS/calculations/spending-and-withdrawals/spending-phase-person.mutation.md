# Mutation receipt: spending-phase-person

Executed 2026-09-28 on branch `claude/people-order-and-scenarios` at base `da378d9b` (no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `df5da329` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6567821b` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
diff --git a/packages/engine/src/projection/simulate.ts b/packages/engine/src/projection/simulate.ts
index 96bb0bb3..e6d5033b 100644
--- a/packages/engine/src/projection/simulate.ts
+++ b/packages/engine/src/projection/simulate.ts
@@ -1923,3 +1923,3 @@
       // then its only person is the one.
-      phasesPersonId: plan.expenses.phasesAgeOf ?? primary.id,
+      phasesPersonId: primary.id,
       resolvePerson: stateOf,
```

Read the first-listed person's age for the phases, the rule before schema v7. The worksheet's household lists Alex first and names Sam, so the 0.9 phase starts in 2037 on Alex's 75th year instead of 2039 on Sam's, and the evidence fails on 2037 and on the reversed-order comparison.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/peopleNamed.evidence.test.ts
```

## Captured failing output

Re-executed because merging main (#762, #763) moved the production lines this receipt quotes; the mutation is unchanged. The baseline is green (peopleNamed.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/peopleNamed.evidence.test.ts (7 tests | 2 failed) 184ms
   ❯ spending-phase-person — Whose age the spending phases follow (2)
     × follows Sam’s age, the person the plan names, not Alex’s, who is listed first 58ms
     × gives the same spending with the people listed the other way round 34ms

 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/peopleNamed.evidence.test.ts > spending-phase-person — Whose age the spending phases follow > follows Sam’s age, the person the plan names, not Alex’s, who is listed first
AssertionError: Base spending, 2037: actual 54000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/peopleNamed.evidence.test.ts:88:103
     86|       for (const [label, year] of [['Base spending, 2037', 2037], ['Ba…
     87|         const actual = yearOf(years, year).expenses.baseSpending
     88|         expect(withinTolerance(actual, phases.value(label), tolerance)…
       |                                                                                                       ^
     89|       }
     90|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/peopleNamed.evidence.test.ts > spending-phase-person — Whose age the spending phases follow > gives the same spending with the people listed the other way round
AssertionError: expected [ 60000, 60000, 60000, 60000, …(30) ] to deeply equal [ 60000, 60000, 60000, 60000, …(30) ]

- Expected
+ Received

@@ -8,22 +8,22 @@
    60000,
    60000,
    60000,
    60000,
    60000,
+   60000,
+   60000,
    54000,
    54000,
    54000,
    54000,
    54000,
    54000,
    54000,
    54000,
    54000,
    54000,
-   48000,
-   48000,
    48000,
    48000,
    48000,
    48000,
    48000,

 ❯ src/projection/peopleNamed.evidence.test.ts:93:71
     91|
     92|     it('gives the same spending with the people listed the other way r…
     93|       expect(run(reversed(plan)).map((y) => y.expenses.baseSpending)).…
       |                                                                       ^
     94|     })
     95|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/simulate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/simulate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
