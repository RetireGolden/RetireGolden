# Mutation receipt: funded-ratio-hand-present-value

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/fundedRatio.ts`

```diff
@@ -54,7 +54,7 @@ export function computeFundedRatio(input: FundedRatioInput): FundedRatioResult |
   for (const y of years) {
     if (y.year < fromYear) continue
     toYear = y.year
-    const yearsFromNow = y.year - startYear
+    const yearsFromNow = y.year - startYear + 1
     essentialFlows.push({ yearsFromNow, realAmount: deflate(y.year, y.expenses.requiredSpending) })
     guaranteedFlows.push({
       yearsFromNow,
```

This discounts every ledger year one year late (end-of-period timing for the current year), the first wrong reading in the worksheet: essential PV becomes $299.5356872908 and guaranteed PV $149.7678436454 instead of 138,700/441 and 69,350/441, misses of $14.9767843645 and $7.4883921823 against the 1e-9 tolerance. The ratio stays 50% because both sides shift by the same factor, which is why the unfunded PV assertion in the ratio block is the one that reports; the null-window boundary is unaffected.

## Command

```
npx vitest run src/ladder/fundedRatio.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4impl/packages/engine
 ❯ src/ladder/fundedRatio.evidence.test.ts (4 tests | 3 failed) 4ms
   ❯ funded-ratio-hand-present-value — Funded ratio: present values of essential spending and guaranteed income (4)
     × discounts the deflated essential flows to E = 138,700/441 with the year-0 flow undiscounted 2ms
     × discounts the deflated guaranteed flows to G = 69,350/441 0ms
     × reports the funded ratio 100·G/E = 50% and the unfunded PV E - G 0ms
 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/fundedRatio.evidence.test.ts > funded-ratio-hand-present-value — Funded ratio: present values of essential spending and guaranteed income > discounts the deflated essential flows to E = 138,700/441 with the year-0 flow undiscounted
AssertionError: expected 14.97678436451065 to be less than or equal to 1e-9
 ❯ src/ladder/fundedRatio.evidence.test.ts:82:104
     80|     it('discounts the deflated essential flows to E = 138,700/441 with…
     81|       expect(result).not.toBeNull()
     82|       expect(Math.abs(result!.essentialSpendingPv - (example.expected.…
       |                                                                                                        ^
     83|     })
     84|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯
 FAIL  src/ladder/fundedRatio.evidence.test.ts > funded-ratio-hand-present-value — Funded ratio: present values of essential spending and guaranteed income > discounts the deflated guaranteed flows to G = 69,350/441
AssertionError: expected 7.488392182305347 to be less than or equal to 1e-9
 ❯ src/ladder/fundedRatio.evidence.test.ts:86:102
     84|
     85|     it('discounts the deflated guaranteed flows to G = 69,350/441', ()…
     86|       expect(Math.abs(result!.guaranteedIncomePv - (example.expected.g…
       |                                                                                                      ^
     87|     })
     88|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯
 FAIL  src/ladder/fundedRatio.evidence.test.ts > funded-ratio-hand-present-value — Funded ratio: present values of essential spending and guaranteed income > reports the funded ratio 100·G/E = 50% and the unfunded PV E - G
AssertionError: expected 7.488392182305347 to be less than or equal to 1e-9
 ❯ src/ladder/fundedRatio.evidence.test.ts:93:86
     91|         RATIO_ABS_TOLERANCE_PCT,
     92|       )
     93|       expect(Math.abs(result!.unfundedPv - (example.expected.unfundedP…
       |                                                                                      ^
     94|     })
     95|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

`git checkout -- packages/engine/src/ladder/fundedRatio.ts`, then `git diff --quiet -- packages/engine/src/ladder/fundedRatio.ts` exited 0, confirming no change to production code after the run.
