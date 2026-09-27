# Mutation receipt: projection-summary-fi-number

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e` and 2026-09-22 against base `7ae019a8` (pull request #727) on the inline spending sum, which B2-P1 slice 1 replaced on 2026-09-26 by a call of `projection/yearFigures.ts#spendingWithTaxAndPenalties`; the same mutation is rewritten below for that code, and re-executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `94954596` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 7b631048..2604c715 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -344,3 +344,3 @@
   const nominalSpendingAtFI = targetResult
-    ? spendingWithTaxAndPenalties(targetResult)
+    ? targetResult.expenses.intendedSpending + targetResult.tax + targetResult.penalties
     : plan.expenses.baseAnnual
```

Price intended spending instead of published funded expenses.total.

The assertion this record owns is the one reading `fiNumber: actual 266546.11437470664, worksheet 2043520.21020608`; the mutation also breaks a sibling record's assertion in the same file, because both read the mutated expression. The captured output shows every failure in full.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (19 tests | 6 failed) 22ms
   ❯ projection-summary-fi-number — Projection summary fi number (2)
     × deflates 92000 of 2030 outflows four years and divides by 4 percent 4ms
   ❯ projection-summary-fi-age — Projection summary fi age (2)
     × crosses inclusively in 2027 at age 47 and ignores the later sentinel row 1ms
   ❯ projection-summary-coast-fire-number — Projection summary coast fire number (2)
     × discounts the FI number four years at the simple real 4 percent 0ms
     × equals the FI number when retirement age is already attained 0ms
   ❯ projection-summary-fi-year — First financial-independence crossing year (2)
     × crosses inclusively in 2027 and never waits for the larger 2028 row 1ms
     × publishes null when no row crosses, and null again for an empty ledger 1ms

 Test Files  1 failed (1)
      Tests  6 failed | 13 passed (19)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-year — First financial-independence crossing year > crosses inclusively in 2027 and never waits for the larger 2028 row
AssertionError: fiNumber: actual 0, worksheet 500000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:843:9
    841|         withinTolerance(summary.fiNumber, inputs.fiNumber as number, {…
    842|         `fiNumber: actual ${summary.fiNumber}, worksheet ${inputs.fiNu…
    843|       ).toBe(true)
       |         ^
    844|       expect(summary.fiYear).toBe(expected.crossingFiYear)
    845|       // The worksheet's three wrong readings all land on 2028.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-year — First financial-independence crossing year > publishes null when no row crosses, and null again for an empty ledger
AssertionError: expected 2026 to be null // Object.is equality

- Expected:
null

+ Received:
2026

 ❯ src/projection/compareSummary.evidence.test.ts:855:30
    853|         projection({ endYear: 2028, years: ledger(rows) }),
    854|       )
    855|       expect(summary.fiYear).toBe(expected.nullFiYear)
       |                              ^
    856|       expect(summary.fiYear).not.toBe(expected.horizonFallbackWrongRea…
    857|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
