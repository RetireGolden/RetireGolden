# Mutation receipt: exact-ledger-conversion-execution

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-twelve` at base `2c07f0d7`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `b775e5df` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d33ac09` (branch `claude/b2p1-slice3-comparisons`, pull request #754), and re-executed 2026-09-28 against RetireGolden base `1176b2e5` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `dc0c6c3f` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/evaluateCandidate.ts`

```diff
diff --git a/packages/engine/src/decisions/evaluateCandidate.ts b/packages/engine/src/decisions/evaluateCandidate.ts
index 3609ef16..c20c1e51 100644
--- a/packages/engine/src/decisions/evaluateCandidate.ts
+++ b/packages/engine/src/decisions/evaluateCandidate.ts
@@ -672,7 +672,7 @@ function buildConversionExecution(
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

the merge of slice 4's final head (slice 3 #754, #755, #756, the claimants split) moved the production lines and test titles these receipts quote The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine16/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (23 tests | 1 failed) 1089ms
   ❯ exact-ledger-conversion-execution — Full projection conversion execution (4)
     × returns null when the only shortfall equals its own margin 7ms

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-conversion-execution — Full projection conversion execution > returns null when the only shortfall equals its own margin
AssertionError: expected 2040 to be null // Object.is equality

- Expected:
null

+ Received:
2040

 ❯ src/projection/optimizePlan.evidence.test.ts:328:56
    326|       // 20000 requested, 19000 executed: the shortfall is 1000 and th…
    327|       // is max(1000, 1000); "more than" is strict, so 2040 does not q…
    328|       expect(validation.firstMateriallyUnexecutedYear).toBe(example.ex…
       |                                                        ^
    329|     })
    330|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/evaluateCandidate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/evaluateCandidate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
