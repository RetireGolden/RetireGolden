# Mutation receipt: projection-summary-lifetime-roth-conversions

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `94954596` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6905169c` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `85e2fdb8` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `8f562339` (branch `claude/people-order-and-scenarios`, pull request #765) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
@@ -391,6 +391,7 @@ export function summarizeProjection(plan: Plan, result: ProjectionResult): ProjectionSummary {
   let taxes = 0
   let conversions = 0
   for (const y of result.years) {
     taxes += y.tax + y.penalties
-    conversions += y.rothConversion
+    if (y.rothConversion !== 0) conversions += y.rothConversion
+    else break
   }
```

This stops at the zero-conversion year, dropping 2028 and producing $40,000 — the worksheet's first wrong reading of omitting the zero year by shortening the horizon.

## Command

```
npx vitest run src/projection/compare.evidence.test.ts
```

## Captured failing output

Re-executed because the round-one review of #765 moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (compare.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/compare.evidence.test.ts (1 test | 1 failed) 6ms
   ❯ projection-summary-lifetime-roth-conversions — Lifetime Roth conversions: sum of annual traditional-to-Roth movement (1)
     × sums $40,000 + $0 + $55,500.25 to $95,500.25 over all three projection rows 5ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compare.evidence.test.ts > projection-summary-lifetime-roth-conversions — Lifetime Roth conversions: sum of annual traditional-to-Roth movement > sums $40,000 + $0 + $55,500.25 to $95,500.25 over all three projection rows
AssertionError: lifetimeRothConversions 40000 is not within {"abs":1e-9} of the worksheet's 95500.25: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/compare.evidence.test.ts:65:9
     63|         withinTolerance(summary.lifetimeRothConversions, expected, exa…
     64|         `lifetimeRothConversions ${summary.lifetimeRothConversions} is…
     65|       ).toBe(true)
       |         ^
     66|     })
     67|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
