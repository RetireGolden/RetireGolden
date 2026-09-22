# Mutation receipt: exact-ledger-conversion-execution

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-twelve` at base `2c07f0d7`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/evaluateCandidate.ts`

```diff
diff --git a/packages/engine/src/decisions/evaluateCandidate.ts b/packages/engine/src/decisions/evaluateCandidate.ts
index f18d4c86..eeea7384 100644
--- a/packages/engine/src/decisions/evaluateCandidate.ts
+++ b/packages/engine/src/decisions/evaluateCandidate.ts
@@ -659,7 +659,7 @@ function buildConversionExecution(
       options.materialConversionShortfallDollars,
       requestedAmount * options.materialConversionShortfallPct,
     )
-    if (requestedAmount - executedAmount > materialShortfall) {
+    if (requestedAmount - executedAmount >= materialShortfall) {
       firstMateriallyUnexecutedYear = year
       break
     }
```

Treat "more than" as inclusive — the worksheet's third wrong reading, which makes the 2040 `$1,000` shortfall qualify against its own `$1,000` margin and returns `2040` instead of `null`.

A note on a wrong reading that is not observable here. The worksheet's second wrong reading — resolving the margin once from the `$70,000` requested total rather than per year — was applied first, as `requestedTotal * options.materialConversionShortfallPct`, and the fixture stayed green (exit 0, 10 passed). It is a real misreading of the rule, but it does not change any answer on these rows: 2030's `$10,000` shortfall clears the total-based `$3,500` margin just as it clears its own `$2,000` one, and 2031's `$1,000` shortfall clears neither. The executed mutation above is therefore the one the fixture can see.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/optimizePlan.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (17 tests | 1 failed) 290ms
   ❯ exact-ledger-conversion-execution — Exact ledger conversion execution (4)
     × returns null when the only shortfall equals its own margin 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)

  Transform  transforming modules took 2.52s · 42% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-conversion-execution — Exact ledger conversion execution > returns null when the only shortfall equals its own margin
AssertionError: expected 2040 to be null // Object.is equality

- Expected:
null

+ Received:
2040

 ❯ src/projection/optimizePlan.evidence.test.ts:327:56
    325|       // 20000 requested, 19000 executed: the shortfall is 1000 and th…
    326|       // is max(1000, 1000); "more than" is strict, so 2040 does not q…
    327|       expect(validation.firstMateriallyUnexecutedYear).toBe(example.ex…
       |                                                        ^
    328|     })
    329|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/evaluateCandidate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/evaluateCandidate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
