# Mutation receipt: projection-summary-coast-fire-number

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `94954596` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 7b631048..8582ca0f 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -317,7 +317,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): Proje
   const startYear = result.startYear
   const inflationRate = plan.assumptions.inflationPct / 100
   const defaultReturn = plan.assumptions.defaultReturnPct / 100
-  const realReturn = defaultReturn - inflationRate
+  const realReturn = (1 + defaultReturn) / (1 + inflationRate) - 1

   const primary = plan.household.people[0]
   const birthYear = primary ? isoYear(primary.dob) : 1980
```

Use the Fisher real return instead of the stated simple subtraction.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (19 tests | 1 failed) 21ms
   ❯ projection-summary-coast-fire-number — Projection summary coast fire number (2)
     × discounts the FI number four years at the simple real 4 percent 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 18 passed (19)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-coast-fire-number — Projection summary coast fire number > discounts the FI number four years at the simple real 4 percent
AssertionError: coastFireNumber: actual 1754658.9877093076, worksheet 1746809.64013811: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:393:9
    391|         withinTolerance(summary.coastFireNumber, expected, example.tol…
    392|         `coastFireNumber: actual ${summary.coastFireNumber}, worksheet…
    393|       ).toBe(true)
       |         ^
    394|     })
    395|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
