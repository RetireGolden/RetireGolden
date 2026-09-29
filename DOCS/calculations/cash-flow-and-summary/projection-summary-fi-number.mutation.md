# Mutation receipt: projection-summary-fi-number

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e` and 2026-09-22 against base `7ae019a8` (pull request #727) on the inline spending sum, which B2-P1 slice 1 replaced on 2026-09-26 by a call of `projection/yearFigures.ts#spendingWithTaxAndPenalties`; the same mutation is rewritten below for that code, and re-executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `94954596` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6905169c` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `85e2fdb8` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 6b4a9cfc..0635f512 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -536,3 +536,3 @@
   const nominalSpendingAtFI = pricedYear
-    ? spendingWithTaxAndPenalties(pricedYear)
+    ? pricedYear.expenses.intendedSpending + pricedYear.tax + pricedYear.penalties
     : plan.expenses.baseAnnual
```

Price intended spending instead of published funded expenses.total. The mutation is the same; the year it reads is now named `pricedYear` (the spending year, or the same year of the conversion-free run when it converts; decision D-FI-CONVERSION-TAX), so the hunk is re-pointed at it.

The assertion this record owns is the one reading `fiNumber: actual 266546.11437470664, worksheet 2043520.21020608`; the mutation also breaks a sibling record's assertion in the same file, because both read the mutated expression. The captured output shows every failure in full.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed because the verification's fixes (N1 to N4) moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (23 tests | 9 failed) 27ms
   ❯ projection-summary-fi-number — Projection summary fi number (2)
     × deflates 92000 of 2030 outflows four years and divides by 4 percent 4ms
   ❯ projection-summary-fi-age — Projection summary fi age (2)
     × crosses inclusively in 2027 at age 47 and ignores the later sentinel row 1ms
   ❯ projection-summary-coast-fire-number — Projection summary coast fire number (3)
     × discounts the FI number four years at the simple real 4 percent 1ms
     × discounts a couple over the household's later retirement, 6 years to Robin's 2032, whoever is listed first 1ms
     × equals the FI number when retirement age is already attained 1ms
   ❯ projection-summary-fi-year — First financial-independence crossing year (2)
     × crosses inclusively in 2027 and never waits for the larger 2028 row 0ms
     × publishes null when no row crosses, and null again for an empty ledger 0ms
   ❯ projection-summary-fi-spending-base — Which year and which outflows the FI figures price (3)
     × prices 2032, Robin’s later retirement, from the conversion-free run: 1,842,465.36 1ms
     × keeps the conversion tax only when no conversion-free run is supplied, and says so 0ms

 Test Files  1 failed (1)
      Tests  9 failed | 14 passed (23)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 9 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-number — Projection summary fi number > deflates 92000 of 2030 outflows four years and divides by 4 percent
AssertionError: fiNumber: actual 266546.11437470664, worksheet 2043520.21020608: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:261:9
    259|         withinTolerance(summary.fiNumber!, expected, example.tolerance…
    260|         `fiNumber: actual ${summary.fiNumber}, worksheet ${expected}`,
    261|       ).toBe(true)
       |         ^
    262|     })
    263|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/9]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-age — Projection summary fi age > crosses inclusively in 2027 at age 47 and ignores the later sentinel row
AssertionError: upstream fiNumber: actual 0, worksheet 1000000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:329:9
    327|         withinTolerance(summary.fiNumber!, inputs.fiNumber as number, …
    328|         `upstream fiNumber: actual ${summary.fiNumber}, worksheet ${St…
    329|       ).toBe(true)
       |         ^
    330|       expect(summary.fiYear).toBe(example.expected.fiYear)
    331|       expect(summary.fiAge).toBe(example.expected.fiAge)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/9]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-coast-fire-number — Projection summary coast fire number > discounts the FI number four years at the simple real 4 percent
AssertionError: upstream fiNumber: actual 266546.11437470664, worksheet 2043520.21020608: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:388:9
    386|         withinTolerance(summary.fiNumber!, inputs.fiNumber as number, …
    387|         `upstream fiNumber: actual ${summary.fiNumber}, worksheet ${St…
    388|       ).toBe(true)
       |         ^
    389|       const expected = example.expected.coastFireNumber as number
    390|       expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/9]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-coast-fire-number — Projection summary coast fire number > discounts a couple over the household's later retirement, 6 years to Robin's 2032, whoever is listed first
AssertionError: listed coastFireNumber: actual 132375.19462548115, worksheet 1,456,127.140880293: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:421:11
    419|           withinTolerance(summary.coastFireNumber!, 1_456_127.14088029…
    420|           `${order} coastFireNumber: actual ${summary.coastFireNumber}…
    421|         ).toBe(true)
       |           ^
    422|       }
    423|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/9]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-coast-fire-number — Projection summary coast fire number > equals the FI number when retirement age is already attained
AssertionError: zero-horizon coastFireNumber: actual 266546.11437470664, worksheet 2043520.21020608: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:437:9
    435|         withinTolerance(summary.coastFireNumber!, inputs.fiNumber as n…
    436|         `zero-horizon coastFireNumber: actual ${summary.coastFireNumbe…
    437|       ).toBe(true)
       |         ^
    438|     })
    439|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/9]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-year — First financial-independence crossing year > crosses inclusively in 2027 and never waits for the larger 2028 row
AssertionError: fiNumber: actual 0, worksheet 500000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:872:9
    870|         withinTolerance(summary.fiNumber!, inputs.fiNumber as number, …
    871|         `fiNumber: actual ${summary.fiNumber}, worksheet ${inputs.fiNu…
    872|       ).toBe(true)
       |         ^
    873|       expect(summary.fiYear).toBe(expected.crossingFiYear)
    874|       // The worksheet's three wrong readings all land on 2028.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/9]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-year — First financial-independence crossing year > publishes null when no row crosses, and null again for an empty ledger
AssertionError: expected 2026 to be null // Object.is equality

- Expected:
null

+ Received:
2026

 ❯ src/projection/compareSummary.evidence.test.ts:884:30
    882|         projection({ endYear: 2028, years: ledger(rows) }), { conversi…
    883|       )
    884|       expect(summary.fiYear).toBe(expected.nullFiYear)
       |                              ^
    885|       expect(summary.fiYear).not.toBe(expected.horizonFallbackWrongRea…
    886|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/9]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-spending-base — Which year and which outflows the FI figures price > prices 2032, Robin’s later retirement, from the conversion-free run: 1,842,465.36
AssertionError: fiNumber: actual 167496.85133673085, worksheet 1842465.36470404: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:1124:9
    1122|         withinTolerance(summary.fiNumber!, fiBaseExpected('FI number')…
    1123|         `fiNumber: actual ${summary.fiNumber}, worksheet ${fiBaseExpec…
    1124|       ).toBe(true)
       |         ^
    1125|       expect(
    1126|         withinTolerance(summary.coastFireNumber!, fiBaseExpected('Coas…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/9]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-spending-base — Which year and which outflows the FI figures price > keeps the conversion tax only when no conversion-free run is supplied, and says so
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:1143:90
    1141|       const summary = summarizeProjection(couple('listed'), converting…
    1142|       expect(summary.fiBasis.spendingSource).toBe('conversionTaxInclud…
    1143|       expect(withinTolerance(summary.fiNumber!, 2_303_081.705880049, e…
       |                                                                                          ^
    1144|     })
    1145|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/9]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
