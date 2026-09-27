# Mutation receipt: projection-summary-estate-heir-tax

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 7b631048..3a806a97 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -310,7 +310,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): Proje
       })
     }
   }
-  const heirTax = estateBreakdown.reduce((sum, b) => sum + b.heirTax, 0)
+  const heirTax = estateBreakdown.reduce((sum, b) => sum + b.heirTax - b.charityAmount, 0)
   const estateToCharity = estateBreakdown.reduce((sum, b) => sum + b.charityAmount, 0)

   // FIRE metrics computation
```

Subtract the charity amount a second time from the already resolved heir-tax total.

The assertion this record owns is the one reading `endingEstateHeirTax: actual 26320, worksheet 56320`; the mutation also breaks a sibling record's assertion in the same file, because both read the mutated expression. The captured output shows every failure in full.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from and the test counts it stated no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (19 tests | 2 failed) 22ms
   ❯ projection-summary-ending-after-tax-estate — Projection summary ending after tax estate (2)
     × nets 812345.67 of net worth of both the 25000.00 charity carve-out and the 73210.11 heir tax 6ms
   ❯ projection-summary-estate-heir-tax — Projection summary estate heir tax (2)
     × taxes the non-charity slice of each pre-tax base: 47520 + 8800 + 0 = 56320.00 with a 10% bequest to charity 2ms

 Test Files  1 failed (1)
      Tests  2 failed | 17 passed (19)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-ending-after-tax-estate — Projection summary ending after tax estate > nets 812345.67 of net worth of both the 25000.00 charity carve-out and the 73210.11 heir tax
AssertionError: endingEstateHeirTax: actual 48210.11, worksheet 73210.11: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:559:9
    557|         withinTolerance(summary.endingEstateHeirTax, inputs.endingEsta…
    558|         `endingEstateHeirTax: actual ${summary.endingEstateHeirTax}, w…
    559|       ).toBe(true)
       |         ^
    560|       expect(
    561|         withinTolerance(summary.endingEstateToCharity, inputs.endingEs…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-estate-heir-tax — Projection summary estate heir tax > taxes the non-charity slice of each pre-tax base: 47520 + 8800 + 0 = 56320.00 with a 10% bequest to charity
AssertionError: endingEstateHeirTax: actual 26320, worksheet 56320 (per-account actual traditional=47520, hsa=8800, roth=0): expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:714:9
    712|         `endingEstateHeirTax: actual ${summary.endingEstateHeirTax}, w…
    713|           `(per-account actual ${summary.estateBreakdown.map((row) => …
    714|       ).toBe(true)
       |         ^
    715|     })
    716|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
