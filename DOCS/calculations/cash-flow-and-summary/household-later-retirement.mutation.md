# Mutation receipt: household-later-retirement

Executed 2026-09-29 on branch `claude/people-order-and-scenarios` at base `6905169c` (no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `85e2fdb8` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/householdRetirement.ts`

```diff
diff --git a/packages/engine/src/projection/householdRetirement.ts b/packages/engine/src/projection/householdRetirement.ts
index 00000000..00000000 100644
--- a/packages/engine/src/projection/householdRetirement.ts
+++ b/packages/engine/src/projection/householdRetirement.ts
@@ -1 +1 @@
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

Re-derived for the independent review's N3: the mutation restores, on the rewritten line, the rule N3 replaced. The baseline is green (householdRetirement.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/householdRetirement.evidence.test.ts (4 tests | 3 failed) 57ms
   ❯ household-later-retirement — The household's later retirement, one rule for FI and the funded ratio (4)
     × gives each case its year, person and rule, and who works through the plan 5ms
     × names the same person and year on the FI figures and the funded ratio, and who works through the plan 41ms
     × prices no FI figure and counts no funded ratio when nobody retires in the plan 11ms

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/householdRetirement.evidence.test.ts > household-later-retirement — The household's later retirement, one rule for FI and the funded ratio > gives each case its year, person and rule, and who works through the plan
AssertionError: Case 3: expected [ 2059, 'sam', 'wagesEnd' ] to deeply equal [ 2028, 'alex', 'retirementAge' ]

- Expected
+ Received

  [
-   2028,
-   "alex",
-   "retirementAge",
+   2059,
+   "sam",
+   "wagesEnd",
  ]

 ❯ src/projection/householdRetirement.evidence.test.ts:74:12
     72|         const { retirement, notRetiring: left } = householdRetirement(…
     73|         expect([retirement?.year ?? null, retirement?.personId ?? null…
     74|           .toEqual([expectedYear(label), name?.toLowerCase() ?? null, …
       |            ^
     75|         expect(left.map((p) => p.personId), label).toEqual(notRetiring)
     76|       }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/projection/householdRetirement.evidence.test.ts > household-later-retirement — The household's later retirement, one rule for FI and the funded ratio > names the same person and year on the FI figures and the funded ratio, and who works through the plan
AssertionError: expected [ 'sam', 2059, 'wagesEnd' ] to deeply equal [ 'alex', 2028, 'retirementAge' ]

- Expected
+ Received

  [
-   "alex",
-   2028,
-   "retirementAge",
+   "sam",
+   2059,
+   "wagesEnd",
  ]

 ❯ src/projection/householdRetirement.evidence.test.ts:91:67
     89|       const fi = summarizeProjection(plan, result, { conversionFreeRun…
     90|       const funded = fundedRatioStart(plan, START)
     91|       expect([fi.personId, fi.retirementYear, fi.retirementRule]).toEq…
       |                                                                   ^
     92|       expect([funded.personId, funded.retirementYear, funded.rule]).to…
     93|       expect(fi.notRetiring.map((p) => p.personId)).toEqual(['sam'])

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/householdRetirement.evidence.test.ts > household-later-retirement — The household's later retirement, one rule for FI and the funded ratio > prices no FI figure and counts no funded ratio when nobody retires in the plan
AssertionError: expected [ 153221.0088378507, 2026, 58, …(1) ] to deeply equal [ null, null, null, null ]

- Expected
+ Received

  [
-   null,
-   null,
-   null,
-   null,
+   153221.0088378507,
+   2026,
+   58,
+   59501.392139564676,
  ]

 ❯ src/projection/householdRetirement.evidence.test.ts:104:90
    102|       const result = simulatePlan(plan, { startYear: START, taxCalcula…
    103|       const summary = summarizeProjection(plan, result, { conversionFr…
    104|       expect([summary.fiNumber, summary.fiYear, summary.fiAge, summary…
       |                                                                                          ^
    105|       expect(summary.fiBasis).toMatchObject({ spendingYear: null, spen…
    106|       expect(summary.fiBasis.notRetiring.map((p) => p.personId)).toEqu…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/householdRetirement.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/householdRetirement.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
