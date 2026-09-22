# Mutation receipt: estate-to-charity

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
@@ -281,7 +281,7 @@
         taxablePretaxBase = estateHsaIncomeBase(grossBalance, destination)
       }
       const heirTaxRatePct = heirRateFor(category) * 100
-      const charityFraction = destination === 'charity' ? Math.min(1, charityPct / 100) : 0
+      const charityFraction = Math.min(1, charityPct / 100 + 0.25)
       const charityAmount = grossBalance * charityFraction
       // Spouse destinations carry no terminal income-tax haircut under the
       // valuation convention; other destinations apply the assumed class rate to
```

This adds a flat 25-point charity share to every account regardless of destination, so the spouse-destination Roth carves out as well and the total becomes $110,000 instead of $75,000 — the family of the worksheet's first two wrong readings (a flat share applied everywhere, and the spouse destination included).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (19 tests | 5 failed) 22ms
   ❯ projection-summary-ending-after-tax-estate — Projection summary ending after tax estate (2)
     × nets 812345.67 of net worth of both the 25000.00 charity carve-out and the 73210.11 heir tax 6ms
     × collapses to net worth minus heir tax with no charity destination 1ms
   ❯ projection-summary-estate-heir-tax — Projection summary estate heir tax (2)
     × taxes the non-charity slice of each pre-tax base: 47520 + 8800 + 0 = 56320.00 with a 10% bequest to charity 1ms
     × collapses to base times rate with no charity destination: 52800 + 8800 + 0 = 61600.00 0ms
   ❯ estate-to-charity — Ending estate passing to charity (1)
     × takes 25 percent of the traditional account and all of the taxable one 1ms

 Test Files  1 failed (1)
      Tests  5 failed | 14 passed (19)

  Transform  transforming modules took 2.41s · 43% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-ending-after-tax-estate — Projection summary ending after tax estate > nets 812345.67 of net worth of both the 25000.00 charity carve-out and the 73210.11 heir tax
AssertionError: endingEstateHeirTax: actual 54907.582500000004, worksheet 73210.11: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:559:9
    557|         withinTolerance(summary.endingEstateHeirTax, inputs.endingEsta…
    558|         `endingEstateHeirTax: actual ${summary.endingEstateHeirTax}, w…
    559|       ).toBe(true)
       |         ^
    560|       expect(
    561|         withinTolerance(summary.endingEstateToCharity, inputs.endingEs…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-ending-after-tax-estate — Projection summary ending after tax estate > collapses to net worth minus heir tax with no charity destination
AssertionError: expected 73210.11 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 73210.11

 ❯ src/projection/compareSummary.evidence.test.ts:574:45
    572|       const { plan, result } = estateRun(false)
    573|       const summary = summarizeProjection(plan, result)
    574|       expect(summary.endingEstateToCharity).toBe(0)
       |                                             ^
    575|       const expected = example.expected.withoutCharity as number
    576|       expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-estate-heir-tax — Projection summary estate heir tax > taxes the non-charity slice of each pre-tax base: 47520 + 8800 + 0 = 56320.00 with a 10% bequest to charity
AssertionError: traditional charityAmount: actual 105000, worksheet 30000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:708:9
    706|         withinTolerance(traditional.charityAmount, expectedCharity, ex…
    707|         `traditional charityAmount: actual ${traditional.charityAmount…
    708|       ).toBe(true)
       |         ^
    709|       const expected = example.expected.withCharityDestination as numb…
    710|       expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-estate-heir-tax — Projection summary estate heir tax > collapses to base times rate with no charity destination: 52800 + 8800 + 0 = 61600.00
AssertionError: endingEstateHeirTax (no charity): actual 46200, worksheet 61600: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:723:9
    721|         withinTolerance(summary.endingEstateHeirTax, expected, example…
    722|         `endingEstateHeirTax (no charity): actual ${summary.endingEsta…
    723|       ).toBe(true)
       |         ^
    724|       expect(summary.endingEstateToCharity).toBe(0)
    725|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > estate-to-charity — Ending estate passing to charity > takes 25 percent of the traditional account and all of the taxable one
AssertionError: endingEstateToCharity: actual 110000, worksheet 75000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:1004:9
    1002|         withinTolerance(summary.endingEstateToCharity, expected.ending…
    1003|         `endingEstateToCharity: actual ${summary.endingEstateToCharity…
    1004|       ).toBe(true)
       |         ^
    1005|
    1006|       // Each account's own charity amount, so a compensating pair can…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
