# Mutation receipt: household-later-retirement

Executed 2026-09-29 on branch `claude/people-order-and-scenarios` at base `6905169c` (no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `85e2fdb8` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `8f562339` (branch `claude/people-order-and-scenarios`, pull request #765) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/householdRetirement.ts`

```diff
diff --git a/packages/engine/src/projection/householdRetirement.ts b/packages/engine/src/projection/householdRetirement.ts
index ac755bec..5f35401c 100644
--- a/packages/engine/src/projection/householdRetirement.ts
+++ b/packages/engine/src/projection/householdRetirement.ts
@@ -96,3 +96,2 @@
     const retirementYear = birthYear + person.retirementAge
-    if (lastWageYear !== null && lastWageYear + 1 > retirementYear) return result(lastWageYear + 1, 'wagesPastRetirementAge')
     return result(retirementYear, 'retirementAge')
```

Read a retirement age alone, whatever the wages, the worksheet's wrong reading until the round-one review of #765. Case 11 then names Hal in 2032, a year Gus is still paid wages, instead of Gus in 2041. Case 13 still names Kay's 2028 but has Jay retiring in 2027, though his wages run until his death, instead of working through the plan. The evidence fails on those cases and on the surfaces check, where the FI figures and the funded ratio start in 2032 on Hal's retirement instead of 2041 on Gus's. Re-derived for issues 1 and 3 of that review: the receipt's earlier mutation, the last wage year kept for a person with no retirement age (the independent review's N3), is still pinned by cases 3, 4 and 8.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/householdRetirement.evidence.test.ts
```

## Captured failing output

Re-derived for the round-one review of #765 (issues 1 and 3): the mutation drops the new branch for wages paid past a retirement age. The baseline is green (householdRetirement.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/householdRetirement.evidence.test.ts (5 tests | 2 failed) 77ms
   ❯ household-later-retirement — The household's later retirement, one rule for FI and the funded ratio (5)
     × gives each case its year, person and rule, and who works through the plan 5ms
     × prices the first year without wages paid past a retirement age on the FI figures and the funded ratio, and says why 14ms

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/householdRetirement.evidence.test.ts > household-later-retirement — The household's later retirement, one rule for FI and the funded ratio > gives each case its year, person and rule, and who works through the plan
AssertionError: Case 11: expected [ 2032, 'hal', 'retirementAge' ] to deeply equal [ 2041, 'gus', …(1) ]

- Expected
+ Received

  [
-   2041,
-   "gus",
-   "wagesPastRetirementAge",
+   2032,
+   "hal",
+   "retirementAge",
  ]

 ❯ src/projection/householdRetirement.evidence.test.ts:79:12
     77|         const { retirement, notRetiring: left } = householdRetirement(…
     78|         expect([retirement?.year ?? null, retirement?.personId ?? null…
     79|           .toEqual([expectedYear(label), name?.toLowerCase() ?? null, …
       |            ^
     80|         expect(left.map((p) => p.personId), label).toEqual(notRetiring)
     81|       }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/householdRetirement.evidence.test.ts > household-later-retirement — The household's later retirement, one rule for FI and the funded ratio > prices the first year without wages paid past a retirement age on the FI figures and the funded ratio, and says why
AssertionError: expected [ 'hal', 2032, 'retirementAge', 2032 ] to deeply equal [ 'gus', 2041, …(2) ]

- Expected
+ Received

  [
-   "gus",
-   2041,
-   "wagesPastRetirementAge",
-   2041,
+   "hal",
+   2032,
+   "retirementAge",
+   2032,
  ]

 ❯ src/projection/householdRetirement.evidence.test.ts:113:10
    111|       const summary = summarizeProjection(plan, result, { conversionFr…
    112|       expect([summary.fiBasis.personId, summary.fiBasis.retirementYear…
    113|         .toEqual(['gus', expectedYear('Case 11'), 'wagesPastRetirement…
       |          ^
    114|       const funded = fundedRatioStart(plan, START)
    115|       expect([funded.personId, funded.fromYear, funded.rule]).toEqual(…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/householdRetirement.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/householdRetirement.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
