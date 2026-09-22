# Mutation receipt: swr-rule-ending-after-tax-estate

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/swrComparator.ts`

```diff
diff --git a/packages/engine/src/decisions/swrComparator.ts b/packages/engine/src/decisions/swrComparator.ts
index fb930611..0d3d7e8c 100644
--- a/packages/engine/src/decisions/swrComparator.ts
+++ b/packages/engine/src/decisions/swrComparator.ts
@@ -121,7 +121,7 @@ export function compareSwrRules(
       initialAnnualSpend,
       depletionYear: summary.depletionYear,
       endYear: result.endYear,
-      endingAfterTaxEstate: summary.endingAfterTaxEstate,
+      endingAfterTaxEstate: summary.endingNetWorth,
       lifetimeTaxesAndPenalties: summary.lifetimeTaxesAndPenalties,
     }
   })
```

Publish ending net worth instead of the composed after-tax estate.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/swrComparator.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #727: the heir-tax fixture had grown to two cases since the first execution and the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (swrComparator.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/decisions/swrComparator.evidence.test.ts (6 tests | 1 failed) 90ms
   ❯ swr-rule-ending-after-tax-estate — Swr rule ending after tax estate (1)
     × republishes the 640000.00 summary estate, not the 700000.00 net worth 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-ending-after-tax-estate — Swr rule ending after tax estate > republishes the 640000.00 summary estate, not the 700000.00 net worth
AssertionError: endingAfterTaxEstate: actual 700000, worksheet 640000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/swrComparator.evidence.test.ts:311:11
    309|           withinTolerance(row.endingAfterTaxEstate, expected, example.…
    310|           `endingAfterTaxEstate: actual ${row.endingAfterTaxEstate}, w…
    311|         ).toBe(true)
       |           ^
    312|         expect(row.endingAfterTaxEstate).not.toBe(inputs.endingNetWort…
    313|         expect(row.endingAfterTaxEstate).not.toBe(inputs.endingAfterTa…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/swrComparator.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/swrComparator.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
