# Mutation receipt: fedinvest-csv-tips-parsing

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/fedInvest.ts`

```diff
@@ -94,7 +94,7 @@ export function parseFedInvestCsv(text: string): FedInvestTips[] {
       || !Number.isFinite(endOfDayPrice)
       || endOfDayPrice <= 0
     ) continue
-    tips.push({ cusip, ratePct: rateFraction * 100, maturityIso: `${m[3]}-${m[1]}-${m[2]}`, endOfDayPrice })
+    tips.push({ cusip, ratePct: rateFraction, maturityIso: `${m[3]}-${m[1]}-${m[2]}`, endOfDayPrice })
   }
   return tips.sort((a, b) => a.maturityIso.localeCompare(b.maturityIso))
 }
```

This leaves the published rate as a decimal fraction instead of converting it to percent, the first wrong reading in the worksheet: the synthetic row parses to 0.00125 instead of 0.125, a 0.12375 miss against the 1e-12 tolerance (the displayed percent would be 100x too small). The cusip and ISO-date assertions before it pass. The second failure in the same file, `fedinvest-nearest-tips-maturity`, is the reported worksheet-versus-production discrepancy and fails on the unmutated code as well; it is not caused by this mutation.

## Command

```
npx vitest run src/ladder/fedInvest.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4impl/packages/engine
 ❯ src/ladder/fedInvest.evidence.test.ts (8 tests | 2 failed) 7ms
   ❯ fedinvest-csv-tips-parsing — FedInvest security-price CSV: TIPS rows to reference records (2)
     × parses one synthetic TIPS row: rate to percent, date to ISO, price per $100 face as-is 4ms
   ❯ fedinvest-nearest-tips-maturity — Nearest FedInvest TIPS for a rung year (3)
     × selects the 2035 TIPS for 2033: distance 2 beats distance 3 1ms
 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-csv-tips-parsing — FedInvest security-price CSV: TIPS rows to reference records > parses one synthetic TIPS row: rate to percent, date to ISO, price per $100 face as-is
AssertionError: expected 0.12375 to be less than or equal to 1e-12
 ❯ src/ladder/fedInvest.evidence.test.ts:34:77
     32|       expect(row!.cusip).toBe(example.expected.cusip)
     33|       expect(row!.maturityIso).toBe(example.expected.maturityIso)
     34|       expect(Math.abs(row!.ratePct - (example.expected.ratePct as numb…
       |                                                                             ^
     35|       expect(Math.abs(row!.endOfDayPrice - (example.expected.endOfDayP…
     36|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
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
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

`git checkout -- packages/engine/src/ladder/fedInvest.ts`, then `git diff --quiet -- packages/engine/src/ladder/fedInvest.ts` exited 0, confirming no change to production code after the run.
