# Mutation receipt: swr-rule-ending-after-tax-estate

Executed 2026-09-18 against RetireGolden base `74916a7e` (branch `claude/b1-p4-cards-slice-seven`) in `packages/engine`.

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

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s7/packages/engine

 ❯ src/decisions/swrComparator.evidence.test.ts (6 tests | 1 failed) 86ms
   ❯ swr-rule-ending-after-tax-estate — Swr rule ending after tax estate (1)
     × republishes the 640000.00 summary estate, not the 700000.00 net worth 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-ending-after-tax-estate — Swr rule ending after tax estate > republishes the 640000.00 summary estate, not the 700000.00 net worth
AssertionError: endingAfterTaxEstate: actual 700000, worksheet 640000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/swrComparator.evidence.test.ts:308:11
    306|           withinTolerance(row.endingAfterTaxEstate, expected, example.…
    307|           `endingAfterTaxEstate: actual ${row.endingAfterTaxEstate}, w…
    308|         ).toBe(true)
       |           ^
    309|         expect(row.endingAfterTaxEstate).not.toBe(inputs.endingNetWort…
    310|         expect(row.endingAfterTaxEstate).not.toBe(inputs.endingAfterTa…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/decisions/swrComparator.ts` restored the exact original bytes (compared byte for byte in the harness), and `git diff --quiet -- packages/engine/src/decisions/swrComparator.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (exit 0).
