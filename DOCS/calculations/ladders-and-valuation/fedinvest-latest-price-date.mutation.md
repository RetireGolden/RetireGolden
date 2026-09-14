# Mutation receipt: fedinvest-latest-price-date

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders) in `packages/engine`.

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

This returns the current calendar day, dropping both the one-day step back and the weekend walk, the first wrong reading in the worksheet: from Sunday 2026-07-12 the mutated code answers 2026-07-12 (day 12, weekday 0) instead of Friday 2026-07-10, and from Saturday 2026-07-11 it answers 2026-07-11. All three assertions of the record fail. The fourth failure in the same file, `fedinvest-nearest-tips-maturity`, is the reported worksheet-versus-production discrepancy and fails on the unmutated code as well; it is not caused by this mutation.

## Command

```
npx vitest run src/ladder/fedInvest.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4impl/packages/engine
 ❯ src/ladder/fedInvest.evidence.test.ts (8 tests | 4 failed) 7ms
   ❯ fedinvest-latest-price-date — Latest FedInvest price date: previous business day in local time (3)
     × walks Sunday 2026-07-12 back past Saturday to Friday 2026-07-10 3ms
     × formats that date from local components as 2026-07-10 1ms
     × reaches the same Friday from Saturday 2026-07-11, the intermediate step of the walk 0ms
   ❯ fedinvest-nearest-tips-maturity — Nearest FedInvest TIPS for a rung year (3)
     × selects the 2035 TIPS for 2033: distance 2 beats distance 3 0ms
 Test Files  1 failed (1)
      Tests  4 failed | 4 passed (8)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-latest-price-date — Latest FedInvest price date: previous business day in local time > walks Sunday 2026-07-12 back past Saturday to Friday 2026-07-10
AssertionError: expected 12 to be 10 // Object.is equality
- Expected
+ Received
- 10
+ 12
 ❯ src/ladder/fedInvest.evidence.test.ts:64:30
     62|       expect(date.getFullYear()).toBe(example.expected.year)
     63|       expect(date.getMonth() + 1).toBe(example.expected.month)
     64|       expect(date.getDate()).toBe(example.expected.day)
       |                              ^
     65|       expect(date.getDay()).toBe(example.expected.weekday)
     66|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-latest-price-date — Latest FedInvest price date: previous business day in local time > formats that date from local components as 2026-07-10
AssertionError: expected '2026-07-12' to be '2026-07-10' // Object.is equality
Expected: "2026-07-10"
Received: "2026-07-12"
 ❯ src/ladder/fedInvest.evidence.test.ts:69:39
     67|
     68|     it('formats that date from local components as 2026-07-10', () => {
     69|       expect(latestPriceDateIso(now)).toBe(example.expected.priceDateI…
       |                                       ^
     70|     })
     71|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-latest-price-date — Latest FedInvest price date: previous business day in local time > reaches the same Friday from Saturday 2026-07-11, the intermediate step of the walk
AssertionError: expected '2026-07-11' to be '2026-07-10' // Object.is equality
Expected: "2026-07-10"
Received: "2026-07-11"
 ❯ src/ladder/fedInvest.evidence.test.ts:75:67
     73|       // The worksheet's arithmetic passes through Saturday; starting …
     74|       // must land on the same business day.
     75|       expect(latestPriceDateIso(new Date('2026-07-11T12:00:00'))).toBe…
       |                                                                   ^
     76|     })
     77|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-nearest-tips-maturity — Nearest FedInvest TIPS for a rung year > selects the 2035 TIPS for 2033: distance 2 beats distance 3
AssertionError: expected null to be 'T2035' // Object.is equality
- Expected:
"T2035"
+ Received:
null
 ❯ src/ladder/fedInvest.evidence.test.ts:112:57
    110|       // worksheet's value and fails until that discrepancy is settled.
    111|       const selected = nearestTipsForYear(candidates, targetYear)
    112|       expect(selected === null ? null : selected.cusip).toBe(example.e…
       |                                                         ^
    113|     })
    114|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

`git checkout -- packages/engine/src/ladder/fedInvest.ts`, then `git diff --quiet -- packages/engine/src/ladder/fedInvest.ts` exited 0, confirming no change to production code after the run.
