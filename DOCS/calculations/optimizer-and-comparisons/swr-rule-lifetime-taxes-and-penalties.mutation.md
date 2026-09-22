# Mutation receipt: swr-rule-lifetime-taxes-and-penalties

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/swrComparator.ts`

```diff
diff --git a/packages/engine/src/decisions/swrComparator.ts b/packages/engine/src/decisions/swrComparator.ts
index fb930611..cf2fb773 100644
--- a/packages/engine/src/decisions/swrComparator.ts
+++ b/packages/engine/src/decisions/swrComparator.ts
@@ -122,7 +122,7 @@ export function compareSwrRules(
       depletionYear: summary.depletionYear,
       endYear: result.endYear,
       endingAfterTaxEstate: summary.endingAfterTaxEstate,
-      lifetimeTaxesAndPenalties: summary.lifetimeTaxesAndPenalties,
+      lifetimeTaxesAndPenalties: result.years.reduce((sum, y) => sum + y.tax, 0),
     }
   })
 }
```

Re-aggregate the tax channel alone instead of republishing the summary total.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/swrComparator.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #727: the heir-tax fixture had grown to two cases since the first execution and the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (swrComparator.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/decisions/swrComparator.evidence.test.ts (6 tests | 1 failed) 127ms
   ❯ swr-rule-lifetime-taxes-and-penalties — Swr rule lifetime taxes and penalties (1)
     × republishes 115250.25, not the 112500.00 tax channel alone 7ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-lifetime-taxes-and-penalties — Swr rule lifetime taxes and penalties > republishes 115250.25, not the 112500.00 tax channel alone
AssertionError: lifetimeTaxesAndPenalties: actual 112500, worksheet 115250.25: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/swrComparator.evidence.test.ts:354:11
    352|           withinTolerance(row.lifetimeTaxesAndPenalties, expected, exa…
    353|           `lifetimeTaxesAndPenalties: actual ${row.lifetimeTaxesAndPen…
    354|         ).toBe(true)
       |           ^
    355|         expect(row.lifetimeTaxesAndPenalties).not.toBe(inputs.summaryL…
    356|         expect(row.lifetimeTaxesAndPenalties).not.toBe(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/swrComparator.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/swrComparator.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
