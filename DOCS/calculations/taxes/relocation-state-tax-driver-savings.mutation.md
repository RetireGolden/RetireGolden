# Mutation receipt: relocation-state-tax-driver-savings

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/relocation.ts`

```diff
diff --git a/packages/engine/src/projection/relocation.ts b/packages/engine/src/projection/relocation.ts
index c7e78e6d..31dd324f 100644
--- a/packages/engine/src/projection/relocation.ts
+++ b/packages/engine/src/projection/relocation.ts
@@ -410,7 +410,7 @@ function computeDrivers(
   return {
     facts,
     totalStateLocalTax: total,
-    ssTreatmentSavings: ssVariant.sum - total,
+    ssTreatmentSavings: total - ssVariant.sum,
     retirementExclusionSavings: retirementVariant.sum - total,
     publicPensionExclusionSavings: publicVariant.sum - total,
     capitalGainsTreatmentSavings: capitalGainsVariant.sum - total,
```

Reverse the counterfactual subtraction for the Social Security driver.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/relocation.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 on B2-P1 slice 3, which moved the lines this receipt quotes (new comparison fields, basis doc comments and helper calls in the production file, or new cases and fixture fields in the evidence file) without changing the mutation, so the hunk header, capture, blob hash and revert note are refreshed against this head. The baseline is green (relocation.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/relocation.evidence.test.ts (2 tests | 1 failed) 43ms
   ❯ relocation-state-tax-driver-savings — Relocation state tax driver savings (1)
     × attributes 1300, 1800, 550 and -150 from the one-at-a-time recomputations 9ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/relocation.evidence.test.ts > relocation-state-tax-driver-savings — Relocation state tax driver savings > attributes 1300, 1800, 550 and -150 from the one-at-a-time recomputations
AssertionError: ssTreatmentSavings: actual -1300, worksheet 1300: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/relocation.evidence.test.ts:229:13
    227|             withinTolerance(actual, worksheet, example.tolerance),
    228|             `${String(field)}: actual ${actual}, worksheet ${worksheet…
    229|           ).toBe(true)
       |             ^
    230|         }
    231|         // The wrong reading: reversing the counterfactual subtraction.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/relocation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/relocation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
