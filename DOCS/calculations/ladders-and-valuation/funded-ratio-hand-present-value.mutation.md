# Mutation receipt: funded-ratio-hand-present-value

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6905169c` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/fundedRatio.ts`

```diff
@@ -56,7 +56,7 @@ export function computeFundedRatio(input: FundedRatioInput): FundedRatioResult |
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

Re-executed because the independent review's fixes (M1 to L3) moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (fundedRatio.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/ladder/fundedRatio.evidence.test.ts (4 tests | 3 failed) 5ms
   ❯ funded-ratio-hand-present-value — Funded ratio: present values of essential spending and guaranteed income (4)
     × discounts the deflated essential flows to E = 138,700/441 with the year-0 flow undiscounted 4ms
     × discounts the deflated guaranteed flows to G = 69,350/441 0ms
     × reports the funded ratio 100·G/E = 50% and the unfunded PV E - G 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ladder/fundedRatio.evidence.test.ts > funded-ratio-hand-present-value — Funded ratio: present values of essential spending and guaranteed income > discounts the deflated essential flows to E = 138,700/441 with the year-0 flow undiscounted
AssertionError: essentialSpendingPv 299.5356872907893 is not within {"abs":1e-9} of the worksheet's 314.5124716553: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/fundedRatio.evidence.test.ts:85:9
     83|         withinTolerance(result!.essentialSpendingPv, expected, example…
     84|         `essentialSpendingPv ${result!.essentialSpendingPv} is not wit…
     85|       ).toBe(true)
       |         ^
     86|     })
     87|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/ladder/fundedRatio.evidence.test.ts > funded-ratio-hand-present-value — Funded ratio: present values of essential spending and guaranteed income > discounts the deflated guaranteed flows to G = 69,350/441
AssertionError: guaranteedIncomePv 149.76784364539466 is not within {"abs":1e-9} of the worksheet's 157.2562358277: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/fundedRatio.evidence.test.ts:93:9
     91|         withinTolerance(result!.guaranteedIncomePv, expected, example.…
     92|         `guaranteedIncomePv ${result!.guaranteedIncomePv} is not withi…
     93|       ).toBe(true)
       |         ^
     94|     })
     95|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/ladder/fundedRatio.evidence.test.ts > funded-ratio-hand-present-value — Funded ratio: present values of essential spending and guaranteed income > reports the funded ratio 100·G/E = 50% and the unfunded PV E - G
AssertionError: unfundedPv 149.76784364539466 is not within {"abs":1e-9} of the worksheet's 157.2562358277: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/ladder/fundedRatio.evidence.test.ts:106:9
    104|         withinTolerance(result!.unfundedPv, expectedUnfundedPv, exampl…
    105|         `unfundedPv ${result!.unfundedPv} is not within ${JSON.stringi…
    106|       ).toBe(true)
       |         ^
    107|     })
    108|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/fundedRatio.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/fundedRatio.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
