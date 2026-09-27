# Mutation receipt: swr-rule-ending-after-tax-estate

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/swrComparator.ts`

```diff
diff --git a/packages/engine/src/decisions/swrComparator.ts b/packages/engine/src/decisions/swrComparator.ts
index 5479cc7b..44a1efde 100644
--- a/packages/engine/src/decisions/swrComparator.ts
+++ b/packages/engine/src/decisions/swrComparator.ts
@@ -132,5 +132,5 @@ export function compareSwrRules(
       depletionYear: summary.depletionYear,
       endYear: result.endYear,
-      endingAfterTaxEstate: summary.endingAfterTaxEstate,
+      endingAfterTaxEstate: summary.endingNetWorth,
       endingAfterTaxEstateTodayDollars:
         result.years.length === 0
```

Publish ending net worth instead of the composed after-tax estate. Rewritten for B2-P1 slice 2, which added the today's-dollar estate to the same result literal: the mutated line is unchanged and only the surrounding context moved.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/swrComparator.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after the independent review of B2-P1 slice 2 changed this receipt's evidence file or moved the lines it mutates, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (swrComparator.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/decisions/swrComparator.evidence.test.ts (7 tests | 1 failed) 113ms
   ❯ swr-rule-ending-after-tax-estate — Swr rule ending after tax estate (1)
     × republishes the 640000.00 summary estate, not the 700000.00 net worth 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-ending-after-tax-estate — Swr rule ending after tax estate > republishes the 640000.00 summary estate, not the 700000.00 net worth
AssertionError: endingAfterTaxEstate: actual 700000, worksheet 640000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/swrComparator.evidence.test.ts:320:11
    318|           withinTolerance(row.endingAfterTaxEstate, expected, example.…
    319|           `endingAfterTaxEstate: actual ${row.endingAfterTaxEstate}, w…
    320|         ).toBe(true)
       |           ^
    321|         expect(row.endingAfterTaxEstate).not.toBe(inputs.endingNetWort…
    322|         expect(row.endingAfterTaxEstate).not.toBe(inputs.endingAfterTa…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/swrComparator.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/swrComparator.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
