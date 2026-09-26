# Mutation receipt: projection-summary-ending-net-worth

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `94954596` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
diff --git a/packages/engine/src/projection/compare.ts b/packages/engine/src/projection/compare.ts
index 7b631048..dc2e8857 100644
--- a/packages/engine/src/projection/compare.ts
+++ b/packages/engine/src/projection/compare.ts
@@ -354,7 +354,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): Proje
     lifetimeTaxesAndPenalties: taxes,
     lifetimeRothConversions: conversions,
     endingInvestable: result.endingInvestable,
-    endingNetWorth: result.endingNetWorth,
+    endingNetWorth: result.endingInvestable,
     // What heirs receive: net worth less heir tax and less any charitable
     // bequests (charity leaves the heirs' estate but is never taxed). With no
     // charity destination this equals net worth − heir tax, as before.
```

Substitute ending investable for the composed net-worth endpoint.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-26 for the review round of B2-P1 slice 1, whose new moneyLasts import moved every line of compare.ts by one (the mutated code is unchanged), so every capture, blob hash and revert note is refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine4/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (19 tests | 1 failed) 21ms
   ❯ projection-summary-ending-net-worth — Projection summary ending net worth (1)
     × republishes 812345.67 and never substitutes ending investable 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 18 passed (19)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-ending-net-worth — Projection summary ending net worth > republishes 812345.67 and never substitutes ending investable
AssertionError: endingNetWorth: actual 438765.43, worksheet 812345.67: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compareSummary.evidence.test.ts:206:9
    204|         withinTolerance(summary.endingNetWorth, expected, example.tole…
    205|         `endingNetWorth: actual ${summary.endingNetWorth}, worksheet $…
    206|       ).toBe(true)
       |         ^
    207|       expect(summary.endingNetWorth).not.toBe(investable)
    208|       expect(summary.endingNetWorth).not.toBe(netWorth + investable)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
