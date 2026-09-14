# Mutation receipt: fedinvest-latest-price-date

Executed 2026-09-14 against RetireGolden head `efaeb827` (branch claude/b1-p4-cards-longevity) in `packages/engine`. This run replaces the same-day run against base `319c16ca` (branch claude/b1-p4-cards-ladders), which was captured before the `fedinvest-nearest-tips-maturity` worksheet was re-derived with the one-year window and so also showed that block failing on unmutated code. At this head that block passes, and the only failures in the file are the three this mutation causes.

## Mutation applied to `packages/engine/src/ladder/fedInvest.ts`

```diff
@@ -48,8 +48,6 @@ export const FEDINVEST_CSV_URL = 'https://www.treasurydirect.gov/GA-FI/FedInvest
 /** Most recent likely-published business day (prices publish evenings, US). */
 export function latestPriceDate(now = new Date()): Date {
   const d = new Date(now)
-  d.setDate(d.getDate() - 1) // yesterday: today's prices aren't out yet
-  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1)
   return d
 }
 
```

This returns the current calendar day, dropping both the one-day step back and the weekend walk, the first wrong reading in the worksheet: from Sunday 2026-07-12 the mutated code answers 2026-07-12 (day 12, weekday 0) instead of Friday 2026-07-10, and from Saturday 2026-07-11 it answers 2026-07-11. All three assertions of the record fail; the other two blocks in the same file (`fedinvest-csv-tips-parsing`, `fedinvest-nearest-tips-maturity`) pass unchanged.

## Command

```
npx vitest run src/ladder/fedInvest.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines and the `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4long/packages/engine
 ❯ src/ladder/fedInvest.evidence.test.ts (9 tests | 3 failed) 7ms
   ❯ fedinvest-latest-price-date — Latest FedInvest price date: previous business day in local time (3)
     × walks Sunday 2026-07-12 back past Saturday to Friday 2026-07-10 3ms
     × formats that date from local components as 2026-07-10 1ms
     × reaches the same Friday from Saturday 2026-07-11, the intermediate step of the walk 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-latest-price-date — Latest FedInvest price date: previous business day in local time > walks Sunday 2026-07-12 back past Saturday to Friday 2026-07-10
AssertionError: expected 12 to be 10 // Object.is equality
- Expected
+ Received
- 10
+ 12
 ❯ src/ladder/fedInvest.evidence.test.ts:71:30
     69|       expect(date.getFullYear()).toBe(example.expected.year)
     70|       expect(date.getMonth() + 1).toBe(example.expected.month)
     71|       expect(date.getDate()).toBe(example.expected.day)
       |                              ^
     72|       expect(date.getDay()).toBe(example.expected.weekday)
     73|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-latest-price-date — Latest FedInvest price date: previous business day in local time > formats that date from local components as 2026-07-10
AssertionError: expected '2026-07-12' to be '2026-07-10' // Object.is equality
Expected: "2026-07-10"
Received: "2026-07-12"
 ❯ src/ladder/fedInvest.evidence.test.ts:76:39
     74|
     75|     it('formats that date from local components as 2026-07-10', () => {
     76|       expect(latestPriceDateIso(now)).toBe(example.expected.priceDateI…
       |                                       ^
     77|     })
     78|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-latest-price-date — Latest FedInvest price date: previous business day in local time > reaches the same Friday from Saturday 2026-07-11, the intermediate step of the walk
AssertionError: expected '2026-07-11' to be '2026-07-10' // Object.is equality
Expected: "2026-07-10"
Received: "2026-07-11"
 ❯ src/ladder/fedInvest.evidence.test.ts:82:67
     80|       // The worksheet's arithmetic passes through Saturday; starting …
     81|       // must land on the same business day.
     82|       expect(latestPriceDateIso(new Date('2026-07-11T12:00:00'))).toBe…
       |                                                                   ^
     83|     })
     84|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
 Test Files  1 failed (1)
      Tests  3 failed | 6 passed (9)
```

## Revert

`git checkout -- packages/engine/src/ladder/fedInvest.ts`, then `git diff --quiet -- packages/engine/src/ladder/fedInvest.ts` exited 0, confirming no change to production code after the run.
