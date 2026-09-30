# Mutation receipt: display-years-before-plan-end

Executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `a1fd6d59` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/moneyLasts.ts`

```diff
diff --git a/packages/engine/src/projection/moneyLasts.ts b/packages/engine/src/projection/moneyLasts.ts
index dafbd67c..a09cbaff 100644
--- a/packages/engine/src/projection/moneyLasts.ts
+++ b/packages/engine/src/projection/moneyLasts.ts
@@ -43,3 +43,3 @@
 export function lastFundedYear(result: Pick<ProjectionResult, 'depletionYear' | 'endYear'>): number {
-  return result.depletionYear === null ? result.endYear : result.depletionYear - 1
+  return result.depletionYear === null ? result.endYear : result.depletionYear
 }
```

Names the depletion year as the last funded year, the worksheet's second wrong reading: case A then says the money lasts through 2028, a year it ran short, and counts 0 years short of the plan's end instead of 1.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/moneyLasts.evidence.test.ts
```

## Captured failing output

The slice 3 review fixes moved compareMoneyLasts and conversionScheduleTotal, rewrote comments in these files and added evidence tests, so the hunk headers and test counts are re-pointed. The baseline is green (moneyLasts.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/moneyLasts.evidence.test.ts (7 tests | 5 failed) 34ms
   ❯ display-years-before-plan-end — Money lasts: the last funded year and the years short of the plan's end (7)
     × caseA: the last funded year and the years short of the plan's end 5ms
     × caseB: the last funded year and the years short of the plan's end 1ms
     × caseD: the last funded year and the years short of the plan's end 0ms
     × reads the depletion year the ledger publishes (the depletion worksheet plan, to 2028 and to 2030) 27ms
     × moves every money-lasts difference by nothing: both conventions shift each result by one year 0ms

 Test Files  1 failed (1)
      Tests  5 failed | 2 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/moneyLasts.evidence.test.ts > display-years-before-plan-end — Money lasts: the last funded year and the years short of the plan's end > caseA: the last funded year and the years short of the plan's end
AssertionError: expected { depletionYear: 2028, …(3) } to deeply equal { depletionYear: 2028, …(3) }

- Expected
+ Received

  {
    "depletionYear": 2028,
    "endYear": 2028,
-   "lastFundedYear": 2027,
-   "yearsShortOfPlanEnd": 1,
+   "lastFundedYear": 2028,
+   "yearsShortOfPlanEnd": 0,
  }

 ❯ src/projection/moneyLasts.evidence.test.ts:51:31
     49|       it(`${key}: the last funded year and the years short of the plan…
     50|         const c = inputs[key]!
     51|         expect(moneyLasts(c)).toEqual(expected[key])
       |                               ^
     52|         // The retired sentence counted endYear - depletionYear.
     53|         expect(c.endYear - c.depletionYear!).toBe(expected[`retiredSen…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/projection/moneyLasts.evidence.test.ts > display-years-before-plan-end — Money lasts: the last funded year and the years short of the plan's end > caseB: the last funded year and the years short of the plan's end
AssertionError: expected { depletionYear: 2028, …(3) } to deeply equal { depletionYear: 2028, …(3) }

- Expected
+ Received

  {
    "depletionYear": 2028,
    "endYear": 2030,
-   "lastFundedYear": 2027,
-   "yearsShortOfPlanEnd": 3,
+   "lastFundedYear": 2028,
+   "yearsShortOfPlanEnd": 2,
  }

 ❯ src/projection/moneyLasts.evidence.test.ts:51:31
     49|       it(`${key}: the last funded year and the years short of the plan…
     50|         const c = inputs[key]!
     51|         expect(moneyLasts(c)).toEqual(expected[key])
       |                               ^
     52|         // The retired sentence counted endYear - depletionYear.
     53|         expect(c.endYear - c.depletionYear!).toBe(expected[`retiredSen…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/projection/moneyLasts.evidence.test.ts > display-years-before-plan-end — Money lasts: the last funded year and the years short of the plan's end > caseD: the last funded year and the years short of the plan's end
AssertionError: expected { depletionYear: 2026, …(3) } to deeply equal { depletionYear: 2026, …(3) }

- Expected
+ Received

  {
    "depletionYear": 2026,
    "endYear": 2060,
-   "lastFundedYear": 2025,
-   "yearsShortOfPlanEnd": 35,
+   "lastFundedYear": 2026,
+   "yearsShortOfPlanEnd": 34,
  }

 ❯ src/projection/moneyLasts.evidence.test.ts:51:31
     49|       it(`${key}: the last funded year and the years short of the plan…
     50|         const c = inputs[key]!
     51|         expect(moneyLasts(c)).toEqual(expected[key])
       |                               ^
     52|         // The retired sentence counted endYear - depletionYear.
     53|         expect(c.endYear - c.depletionYear!).toBe(expected[`retiredSen…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/projection/moneyLasts.evidence.test.ts > display-years-before-plan-end — Money lasts: the last funded year and the years short of the plan's end > reads the depletion year the ledger publishes (the depletion worksheet plan, to 2028 and to 2030)
AssertionError: caseA: expected { depletionYear: 2028, …(3) } to deeply equal { depletionYear: 2028, …(3) }

- Expected
+ Received

  {
    "depletionYear": 2028,
    "endYear": 2028,
-   "lastFundedYear": 2027,
-   "yearsShortOfPlanEnd": 1,
+   "lastFundedYear": 2028,
+   "yearsShortOfPlanEnd": 0,
  }

 ❯ src/projection/moneyLasts.evidence.test.ts:68:41
     66|         const result = depletionRun(c.annualSpending!, c.endYear)
     67|         expect(result.depletionYear, key).toBe(c.depletionYear)
     68|         expect(moneyLasts(result), key).toEqual(expected[key])
       |                                         ^
     69|       }
     70|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/projection/moneyLasts.evidence.test.ts > display-years-before-plan-end — Money lasts: the last funded year and the years short of the plan's end > moves every money-lasts difference by nothing: both conventions shift each result by one year
AssertionError: expected 1 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 1

 ❯ src/projection/moneyLasts.evidence.test.ts:88:72
     86|       for (const candidate of results) {
     87|         for (const baseline of results) {
     88|           expect(lastFundedYear(candidate) - lastFundedYear(baseline))…
       |                                                                        ^
     89|         }
     90|       }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/moneyLasts.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/moneyLasts.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
