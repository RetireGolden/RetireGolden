# Mutation receipt: irmaa-lookback-selection

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualHealthcareExpenses.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualHealthcareExpenses.evidence.test.ts (4 tests | 1 failed) 28ms
   ❯ irmaa-lookback-selection — IRMAA lookback MAGI selection (4)
     × keeps year minus two on a tie, because the comparison is strictly lower 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualHealthcareExpenses.evidence.test.ts > irmaa-lookback-selection — IRMAA lookback MAGI selection > keeps year minus two on a tie, because the comparison is strictly lower
AssertionError: expected 2027 to be 2026 // Object.is equality

- Expected
+ Received

- 2026
+ 2027

 ❯ src/projection/internal/annualHealthcareExpenses.evidence.test.ts:133:30
    131|     it('keeps year minus two on a tie, because the comparison is stric…
    132|       const selection = selectionFor(tiedYears, true)
    133|       expect(selection.year).toBe(expected.ssa44Tie!.year)
       |                              ^
    134|       expect(selection.source).toBe(expected.ssa44Tie!.source)
    135|       expectWithin(selection.magi, expected.ssa44Tie!.magi, example.to…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualHealthcareExpenses.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualHealthcareExpenses.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
