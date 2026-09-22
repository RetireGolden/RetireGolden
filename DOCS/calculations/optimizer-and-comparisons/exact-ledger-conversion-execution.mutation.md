# Mutation receipt: exact-ledger-conversion-execution

Executed 2026-09-18 against RetireGolden base `2c07f0d7` (branch `claude/b1-p4-cards-slice-twelve`) in `packages/engine`.

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

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s12/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (10 tests | 1 failed) 30ms
   ❯ exact-ledger-conversion-execution — Exact ledger conversion execution (4)
     × returns null when the only shortfall equals its own margin 3ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-conversion-execution — Exact ledger conversion execution > returns null when the only shortfall equals its own margin
AssertionError: expected 2040 to be null // Object.is equality

- Expected:
null

+ Received:
2040

 ❯ src/projection/optimizePlan.evidence.test.ts:315:56
    313|       // 20000 requested, 19000 executed: the shortfall is 1000 and th…
    314|       // is max(1000, 1000); "more than" is strict, so 2040 does not q…
    315|       expect(validation.firstMateriallyUnexecutedYear).toBe(example.ex…
       |                                                        ^
    316|     })
    317|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
```

## Revert

`git checkout -- packages/engine/src/decisions/evaluateCandidate.ts` restored the file, and `git diff --quiet -- packages/engine/src/decisions/evaluateCandidate.ts` then exited 0, confirming no production change remained. The same revert and the same check were run after the non-observable total-margin attempt described above. Re-ran the named command after restoration: the named file passed again (10 passed, exit 0).
