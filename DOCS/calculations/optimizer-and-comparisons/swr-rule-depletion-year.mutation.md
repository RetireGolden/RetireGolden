# Mutation receipt: swr-rule-depletion-year

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/swrComparator.ts`

```diff
diff --git a/packages/engine/src/decisions/swrComparator.ts b/packages/engine/src/decisions/swrComparator.ts
index 5479cc7b..dc87c6de 100644
--- a/packages/engine/src/decisions/swrComparator.ts
+++ b/packages/engine/src/decisions/swrComparator.ts
@@ -130,5 +130,5 @@ export function compareSwrRules(
       initialRatePct: ratePct,
       initialAnnualSpend,
-      depletionYear: summary.depletionYear,
+      depletionYear: [...result.years].sort((a, b) => b.shortfall - a.shortfall)[0]?.year ?? null,
       endYear: result.endYear,
       endingAfterTaxEstate: summary.endingAfterTaxEstate,
```

Select the largest-shortfall year instead of the first year over the residual budget. Rewritten for B2-P1 slice 2, which added the today's-dollar estate to the same result literal: the mutated line is unchanged and only the surrounding context moved.

The assertion this record owns is the one reading `expected 2042 to be 2041`; the mutation also breaks a sibling record's assertion in the same file, because both read the mutated expression. The captured output shows every failure in full.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/swrComparator.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after the independent review of B2-P1 slice 2 changed this receipt's evidence file or moved the lines it mutates, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (swrComparator.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/decisions/swrComparator.evidence.test.ts (7 tests | 4 failed) 114ms
   ❯ swr-rule-end-year — Swr rule end year (1)
     × publishes the 2055 ledger endpoint, not the 2041 depletion year 5ms
   ❯ swr-rule-depletion-year — Swr rule depletion year (2)
     × selects 2041, the first year whose shortfall clears the half-cent budget 21ms
     × publishes null when no year is short 11ms
   ❯ display-dollar-basis-conversion — Today's dollars by the ledger's own inflation factor (1)
     × publishes each rule ending estate divided by that rule run factor for its end year 31ms

 Test Files  1 failed (1)
      Tests  4 failed | 3 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-end-year — Swr rule end year > publishes the 2055 ledger endpoint, not the 2041 depletion year
AssertionError: expected 2026 to be 2041 // Object.is equality

- Expected
+ Received

- 2041
+ 2026

 ❯ src/decisions/swrComparator.evidence.test.ts:208:35
    206|         const row = rows.find((candidate) => candidate.id === BENGEN)!
    207|         expect(row.endYear).toBe(example.expected.endYear)
    208|         expect(row.depletionYear).toBe(inputs.depletionYear)
       |                                   ^
    209|         expect(row.endYear).not.toBe(inputs.depletionYear)
    210|         expect(row.endYear).not.toBe(inputs.startYear + 30)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-depletion-year — Swr rule depletion year > selects 2041, the first year whose shortfall clears the half-cent budget
AssertionError: expected 2042 to be 2041 // Object.is equality

- Expected
+ Received

- 2041
+ 2042

 ❯ src/decisions/swrComparator.evidence.test.ts:268:33
    266|       // largest-shortfall reading the worksheet rejects would name a …
    267|       // year; the mutation receipt executes exactly that reading.
    268|       expect(row.depletionYear).toBe(example.expected.depletionYear)
       |                                 ^
    269|     })
    270|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-depletion-year — Swr rule depletion year > publishes null when no year is short
AssertionError: expected 2026 to be null // Object.is equality

- Expected:
null

+ Received:
2026

 ❯ src/decisions/swrComparator.evidence.test.ts:276:33
    274|       const rows = compareSwrRules(depletingPlan(example.inputs.funded…
    275|       const row = rows.find((candidate) => candidate.id === BENGEN)!
    276|       expect(row.depletionYear).toBe(example.expected.noShortfallDeple…
       |                                 ^
    277|     })
    278|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > display-dollar-basis-conversion — Today's dollars by the ledger's own inflation factor > publishes each rule ending estate divided by that rule run factor for its end year
AssertionError: bengen-2025: expected 2026 to be null

- Expected:
null

+ Received:
2026

 ❯ src/decisions/swrComparator.evidence.test.ts:421:43
    419|       for (const row of rows) {
    420|         expect(row.endYear, row.id).toBe(inputs.endYear)
    421|         expect(row.depletionYear, row.id).toBeNull()
       |                                           ^
    422|         expect(row.endingAfterTaxEstate, row.id).toBeGreaterThan(0)
    423|         expect(row.endingAfterTaxEstateTodayDollars, row.id).toBe(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/swrComparator.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/swrComparator.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
