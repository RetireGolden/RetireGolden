# Mutation receipt: fedinvest-csv-tips-parsing

Executed 2026-09-14 against RetireGolden head `efaeb827` (branch claude/b1-p4-cards-longevity) in `packages/engine`. This run replaces the same-day run against base `319c16ca` (branch claude/b1-p4-cards-ladders), which was captured before the `fedinvest-nearest-tips-maturity` worksheet was re-derived with the one-year window and so also showed that block failing on unmutated code. At this head that block passes, and the only failure in the file is the one this mutation causes.

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

This leaves the published rate as a decimal fraction instead of converting it to percent, the first wrong reading in the worksheet: the synthetic row parses to 0.00125 instead of 0.125, a 0.12375 miss against the 1e-12 tolerance (the displayed percent would be 100x too small). The cusip and ISO-date assertions before it pass, and the other two blocks in the same file (`fedinvest-latest-price-date`, `fedinvest-nearest-tips-maturity`) pass unchanged.

## Command

```
npx vitest run src/ladder/fedInvest.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines and the `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4long/packages/engine
 ❯ src/ladder/fedInvest.evidence.test.ts (9 tests | 1 failed) 7ms
   ❯ fedinvest-csv-tips-parsing — FedInvest security-price CSV: TIPS rows to reference records (2)
     × parses one synthetic TIPS row: rate to percent, date to ISO, price per $100 face as-is 5ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-csv-tips-parsing — FedInvest security-price CSV: TIPS rows to reference records > parses one synthetic TIPS row: rate to percent, date to ISO, price per $100 face as-is
AssertionError: ratePct 0.00125 is not within {"abs":1e-12} of the worksheet's 0.125: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/ladder/fedInvest.evidence.test.ts:38:9
     36|         withinTolerance(row!.ratePct, expectedRatePct, example.toleran…
     37|         `ratePct ${row!.ratePct} is not within ${JSON.stringify(exampl…
     38|       ).toBe(true)
       |         ^
     39|       expect(
     40|         withinTolerance(row!.endOfDayPrice, expectedPrice, example.tol…
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
```

## Revert

`git checkout -- packages/engine/src/ladder/fedInvest.ts`, then `git diff --quiet -- packages/engine/src/ladder/fedInvest.ts` exited 0, confirming no change to production code after the run.
