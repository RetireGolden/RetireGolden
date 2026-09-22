# Mutation receipt: projection-summary-ending-after-tax-estate

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 893060b3..ad554895 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -358,7 +358,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): Proje
     // What heirs receive: net worth less heir tax and less any charitable
     // bequests (charity leaves the heirs' estate but is never taxed). With no
     // charity destination this equals net worth − heir tax, as before.
-    endingAfterTaxEstate: result.endingNetWorth - estateToCharity - heirTax,
+    endingAfterTaxEstate: result.endingNetWorth - heirTax,
     endingEstateHeirTax: heirTax,
     endingEstateToCharity: estateToCharity,
     estateBreakdown,
```

Ignore the charity carve-out when netting the estate.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #727: the heir-tax fixture had grown to two cases since the first execution and the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (15 tests | 1 failed) 19ms
   ❯ projection-summary-ending-after-tax-estate — Projection summary ending after tax estate (2)
     × nets 812345.67 of net worth of both the 25000.00 charity carve-out and the 73210.11 heir tax 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 14 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-ending-after-tax-estate — Projection summary ending after tax estate > nets 812345.67 of net worth of both the 25000.00 charity carve-out and the 73210.11 heir tax
AssertionError: endingAfterTaxEstate: actual 739135.56, worksheet 714135.56: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:568:9
    566|         withinTolerance(summary.endingAfterTaxEstate, expected, exampl…
    567|         `endingAfterTaxEstate: actual ${summary.endingAfterTaxEstate},…
    568|       ).toBe(true)
       |         ^
    569|     })
    570|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
