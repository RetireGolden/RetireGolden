# Mutation receipt: projection-summary-fi-number

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 893060b3..fa566a58 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -326,7 +326,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): Proje
   // 3. FI Number
   const targetResult = result.years.find((y) => y.year === Math.max(startYear, targetYear)) ?? result.years[0]
   const nominalSpendingAtFI = targetResult
-    ? targetResult.expenses.total + targetResult.tax + targetResult.penalties
+    ? targetResult.expenses.intendedSpending + targetResult.tax + targetResult.penalties
     : plan.expenses.baseAnnual
   const yearsToFIYear = targetResult ? targetResult.year - startYear : 0
   const annualSpendingAtFIToday = nominalSpendingAtFI / Math.pow(1 + inflationRate, yearsToFIYear)
```

Price intended spending instead of published funded expenses.total.

The assertion this record owns is the one reading `fiNumber: actual 266546.11437470664, worksheet 2043520.21020608`; the mutation also breaks a sibling record's assertion in the same file, because both read the mutated expression. The captured output shows every failure in full.

The capture also carries this file's pre-existing `projection-summary-estate-heir-tax` failure (the engine's 56,320.00 against the worksheet's 61,600.00). That failure is present on unmutated production and is not caused by this mutation.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #727: the heir-tax fixture had grown to two cases since the first execution and the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (15 tests | 4 failed) 23ms
   ❯ projection-summary-fi-number — Projection summary fi number (2)
     × deflates 92000 of 2030 outflows four years and divides by 4 percent 4ms
   ❯ projection-summary-fi-age — Projection summary fi age (2)
     × crosses inclusively in 2027 at age 47 and ignores the later sentinel row 1ms
   ❯ projection-summary-coast-fire-number — Projection summary coast fire number (2)
     × discounts the FI number four years at the simple real 4 percent 1ms
     × equals the FI number when retirement age is already attained 1ms

 Test Files  1 failed (1)
      Tests  4 failed | 11 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-number — Projection summary fi number > deflates 92000 of 2030 outflows four years and divides by 4 percent
AssertionError: fiNumber: actual 266546.11437470664, worksheet 2043520.21020608: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:261:9
    259|         withinTolerance(summary.fiNumber, expected, example.tolerance),
    260|         `fiNumber: actual ${summary.fiNumber}, worksheet ${expected}`,
    261|       ).toBe(true)
       |         ^
    262|     })
    263|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-age — Projection summary fi age > crosses inclusively in 2027 at age 47 and ignores the later sentinel row
AssertionError: upstream fiNumber: actual 0, worksheet 1000000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:329:9
    327|         withinTolerance(summary.fiNumber, inputs.fiNumber as number, {…
    328|         `upstream fiNumber: actual ${summary.fiNumber}, worksheet ${St…
    329|       ).toBe(true)
       |         ^
    330|       expect(summary.fiYear).toBe(example.expected.fiYear)
    331|       expect(summary.fiAge).toBe(example.expected.fiAge)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-coast-fire-number — Projection summary coast fire number > discounts the FI number four years at the simple real 4 percent
AssertionError: upstream fiNumber: actual 266546.11437470664, worksheet 2043520.21020608: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:388:9
    386|         withinTolerance(summary.fiNumber, inputs.fiNumber as number, e…
    387|         `upstream fiNumber: actual ${summary.fiNumber}, worksheet ${St…
    388|       ).toBe(true)
       |         ^
    389|       const expected = example.expected.coastFireNumber as number
    390|       expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-coast-fire-number — Projection summary coast fire number > equals the FI number when retirement age is already attained
AssertionError: zero-horizon coastFireNumber: actual 266546.11437470664, worksheet 2043520.21020608: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:408:9
    406|         withinTolerance(summary.coastFireNumber, inputs.fiNumber as nu…
    407|         `zero-horizon coastFireNumber: actual ${summary.coastFireNumbe…
    408|       ).toBe(true)
       |         ^
    409|     })
    410|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
