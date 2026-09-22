# Mutation receipt: swr-rule-depletion-year

Executed 2026-09-18 against RetireGolden base `74916a7e` (branch `claude/b1-p4-cards-slice-seven`) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/swrComparator.ts`

```diff
diff --git a/packages/engine/src/decisions/swrComparator.ts b/packages/engine/src/decisions/swrComparator.ts
index fb930611..be61fb42 100644
--- a/packages/engine/src/decisions/swrComparator.ts
+++ b/packages/engine/src/decisions/swrComparator.ts
@@ -119,7 +119,7 @@ export function compareSwrRules(
       citation: rule.citation,
       initialRatePct: ratePct,
       initialAnnualSpend,
-      depletionYear: summary.depletionYear,
+      depletionYear: [...result.years].sort((a, b) => b.shortfall - a.shortfall)[0]?.year ?? null,
       endYear: result.endYear,
       endingAfterTaxEstate: summary.endingAfterTaxEstate,
       lifetimeTaxesAndPenalties: summary.lifetimeTaxesAndPenalties,
```

Select the largest-shortfall year instead of the first year over the residual budget.

The assertion this record owns is the one reading `expected 2042 to be 2041`; the mutation also breaks a sibling record's assertion in the same file, because both read the mutated expression. The captured output shows every failure in full.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/swrComparator.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s7/packages/engine

 ❯ src/decisions/swrComparator.evidence.test.ts (6 tests | 3 failed) 84ms
   ❯ swr-rule-end-year — Swr rule end year (1)
     × publishes the 2055 ledger endpoint, not the 2041 depletion year 5ms
   ❯ swr-rule-depletion-year — Swr rule depletion year (2)
     × selects 2041, the first year whose shortfall clears the half-cent budget 22ms
     × publishes null when no year is short 8ms

 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-end-year — Swr rule end year > publishes the 2055 ledger endpoint, not the 2041 depletion year
AssertionError: expected 2026 to be 2041 // Object.is equality

- Expected
+ Received

- 2041
+ 2026

 ❯ src/decisions/swrComparator.evidence.test.ts:199:35
    197|         const row = rows.find((candidate) => candidate.id === BENGEN)!
    198|         expect(row.endYear).toBe(example.expected.endYear)
    199|         expect(row.depletionYear).toBe(inputs.depletionYear)
       |                                   ^
    200|         expect(row.endYear).not.toBe(inputs.depletionYear)
    201|         expect(row.endYear).not.toBe(inputs.startYear + 30)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-depletion-year — Swr rule depletion year > selects 2041, the first year whose shortfall clears the half-cent budget
AssertionError: expected 2042 to be 2041 // Object.is equality

- Expected
+ Received

- 2041
+ 2042

 ❯ src/decisions/swrComparator.evidence.test.ts:256:33
    254|       // largest-shortfall reading the worksheet rejects would name a …
    255|       // year; the mutation receipt executes exactly that reading.
    256|       expect(row.depletionYear).toBe(example.expected.depletionYear)
       |                                 ^
    257|     })
    258|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-depletion-year — Swr rule depletion year > publishes null when no year is short
AssertionError: expected 2026 to be null // Object.is equality

- Expected:
null

+ Received:
2026

 ❯ src/decisions/swrComparator.evidence.test.ts:264:33
    262|       const rows = compareSwrRules(depletingPlan(60), opts())
    263|       const row = rows.find((candidate) => candidate.id === BENGEN)!
    264|       expect(row.depletionYear).toBe(example.expected.noShortfallDeple…
       |                                 ^
    265|     })
    266|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

`git checkout -- packages/engine/src/decisions/swrComparator.ts` restored the exact original bytes (compared byte for byte in the harness), and `git diff --quiet -- packages/engine/src/decisions/swrComparator.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (exit 0).
