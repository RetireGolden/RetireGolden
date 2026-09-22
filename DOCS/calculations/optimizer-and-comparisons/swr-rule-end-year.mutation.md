# Mutation receipt: swr-rule-end-year

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/swrComparator.ts`

```diff
diff --git a/packages/engine/src/decisions/swrComparator.ts b/packages/engine/src/decisions/swrComparator.ts
index fb930611..d90105bf 100644
--- a/packages/engine/src/decisions/swrComparator.ts
+++ b/packages/engine/src/decisions/swrComparator.ts
@@ -120,7 +120,7 @@ export function compareSwrRules(
       initialRatePct: ratePct,
       initialAnnualSpend,
       depletionYear: summary.depletionYear,
-      endYear: result.endYear,
+      endYear: summary.depletionYear ?? result.endYear,
       endingAfterTaxEstate: summary.endingAfterTaxEstate,
       lifetimeTaxesAndPenalties: summary.lifetimeTaxesAndPenalties,
     }
```

Substitute the depletion year for the ledger endpoint.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/swrComparator.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #727: the heir-tax fixture had grown to two cases since the first execution and the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (swrComparator.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/decisions/swrComparator.evidence.test.ts (6 tests | 1 failed) 162ms
   ❯ swr-rule-end-year — Swr rule end year (1)
     × publishes the 2055 ledger endpoint, not the 2041 depletion year 9ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-end-year — Swr rule end year > publishes the 2055 ledger endpoint, not the 2041 depletion year
AssertionError: expected 2041 to be 2055 // Object.is equality

- Expected
+ Received

- 2055
+ 2041

 ❯ src/decisions/swrComparator.evidence.test.ts:198:29
    196|         }), simOptions())
    197|         const row = rows.find((candidate) => candidate.id === BENGEN)!
    198|         expect(row.endYear).toBe(example.expected.endYear)
       |                             ^
    199|         expect(row.depletionYear).toBe(inputs.depletionYear)
    200|         expect(row.endYear).not.toBe(inputs.depletionYear)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/swrComparator.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/swrComparator.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
