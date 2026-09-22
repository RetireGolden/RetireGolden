# Mutation receipt: inherited-distribution-required-executed-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualInheritedIraDistributions.ts`

```diff
@@ -461,7 +461,7 @@
       } else if (req.kind === 'none' || req.noticeWaived === true) {
         take = 0
       } else {
-        take = Math.min(req.requiredAmount, state.balance)
+        take = req.requiredAmount
       }
       regime = scheduleClass.regime
       matrixRow = scheduleClass.row
```

This executes the uncapped requirement, overdrawing the $5,000 live balance by $3,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualInheritedIraDistributions.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualInheritedIraDistributions.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualInheritedIraDistributions.evidence.test.ts (4 tests | 1 failed) 8ms
   ❯ inherited-distribution-required-executed-annual — Executed inherited required distribution (3)
     × caps an ordinary requirement at the live balance and never above it 6ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualInheritedIraDistributions.evidence.test.ts > inherited-distribution-required-executed-annual — Executed inherited required distribution > caps an ordinary requirement at the live balance and never above it
AssertionError: expected 8000 to be 5000 // Object.is equality

- Expected
+ Received

- 5000
+ 8000

 ❯ src/projection/internal/annualInheritedIraDistributions.evidence.test.ts:186:63
    184|       // The requirement evidence keeps its legal-year amount; only th…
    185|       expect(insufficientRow.evidence.requiredAmount).toBe(inputs.ordi…
    186|       expect(insufficientRow.evidence.executedRequiredAmount).toBe(exp…
       |                                                               ^
    187|       // The worksheet's first wrong reading: executing the uncapped r…
    188|       expect(insufficientRow.evidence.executedRequiredAmount).not.toBe…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualInheritedIraDistributions.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualInheritedIraDistributions.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
