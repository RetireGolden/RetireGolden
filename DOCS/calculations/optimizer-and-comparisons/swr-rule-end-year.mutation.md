# Mutation receipt: swr-rule-end-year

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/swrComparator.ts`

```diff
diff --git a/packages/engine/src/decisions/swrComparator.ts b/packages/engine/src/decisions/swrComparator.ts
index 5479cc7b..c524e931 100644
--- a/packages/engine/src/decisions/swrComparator.ts
+++ b/packages/engine/src/decisions/swrComparator.ts
@@ -131,5 +131,5 @@ export function compareSwrRules(
       initialAnnualSpend,
       depletionYear: summary.depletionYear,
-      endYear: result.endYear,
+      endYear: summary.depletionYear ?? result.endYear,
       endingAfterTaxEstate: summary.endingAfterTaxEstate,
       endingAfterTaxEstateTodayDollars:
```

Substitute the depletion year for the ledger endpoint. Rewritten for B2-P1 slice 2, which added the today's-dollar estate to the same result literal: the mutated line is unchanged and only the surrounding context moved.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/swrComparator.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after the independent review of B2-P1 slice 2 changed this receipt's evidence file or moved the lines it mutates, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (swrComparator.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/decisions/swrComparator.evidence.test.ts (7 tests | 1 failed) 115ms
   ❯ swr-rule-end-year — Swr rule end year (1)
     × publishes the 2055 ledger endpoint, not the 2041 depletion year 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-end-year — Swr rule end year > publishes the 2055 ledger endpoint, not the 2041 depletion year
AssertionError: expected 2041 to be 2055 // Object.is equality

- Expected
+ Received

- 2055
+ 2041

 ❯ src/decisions/swrComparator.evidence.test.ts:207:29
    205|         }), simOptions())
    206|         const row = rows.find((candidate) => candidate.id === BENGEN)!
    207|         expect(row.endYear).toBe(example.expected.endYear)
       |                             ^
    208|         expect(row.depletionYear).toBe(inputs.depletionYear)
    209|         expect(row.endYear).not.toBe(inputs.depletionYear)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/swrComparator.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/swrComparator.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
