# Mutation receipt: irmaa-lookback-selection

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualHealthcareExpenses.ts`

```diff
@@ -96,7 +96,7 @@ export function annualHealthcareExpenses(
   const lookbackSelected = input.ssa44ActiveInYear(input.year)
     ? (() => {
         const alternate = input.resolveMagiFor(input.year - 1)
-        return alternate.magi < lookbackPrimary.magi
+        return alternate.magi <= lookbackPrimary.magi
           ? alternate
           : lookbackPrimary
       })()
```

This makes the SSA-44 comparison non-strict, so an equal year-minus-one MAGI displaces year minus two and the tie case selects 2027 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualHealthcareExpenses.evidence.test.ts
```

## Captured failing output

```
FAIL  src/projection/internal/annualHealthcareExpenses.evidence.test.ts > irmaa-lookback-selection — IRMAA lookback MAGI selection > keeps year minus two on a tie, because the comparison is strictly lower
AssertionError: expected 2027 to be 2026 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualHealthcareExpenses.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualHealthcareExpenses.ts` exited 0, confirming no change to production code after the run.
