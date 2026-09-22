# Mutation receipt: estate-to-charity

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

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

```
 FAIL  src/projection/compareSummary.evidence.test.ts > estate-to-charity — Ending estate passing to charity > takes 25 percent of the traditional account and all of the taxable one
AssertionError: endingEstateToCharity: actual 110000, worksheet 75000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/compare.ts`, then `git diff --quiet -- packages/engine/src/projection/compare.ts` exited 0, confirming no change to production code after the run.
