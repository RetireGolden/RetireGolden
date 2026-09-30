# Mutation receipt: display-total-spending-annual

Executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/yearFigures.ts`

```diff
diff --git a/packages/engine/src/projection/yearFigures.ts b/packages/engine/src/projection/yearFigures.ts
index 9568201b..0919c994 100644
--- a/packages/engine/src/projection/yearFigures.ts
+++ b/packages/engine/src/projection/yearFigures.ts
@@ -52,3 +52,3 @@
 ): number {
-  return year.expenses.total + year.tax + year.penalties
+  return year.expenses.total + (year.tax + year.penalties)
 }
```

Groups tax and penalties before adding expenses, the association the worksheet warns about: case B then gives 59,370.509999999995 instead of the left-to-right 59,370.51, one binary digit off what the pages printed and off the FI base.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/yearFigures.evidence.test.ts
```

## Captured failing output

The baseline is green (yearFigures.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/yearFigures.evidence.test.ts (13 tests | 1 failed) 44ms
   ❯ display-total-spending-annual — Total spending with tax and penalties (2)
     × adds expenses, tax and penalties left to right 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/yearFigures.evidence.test.ts > display-total-spending-annual — Total spending with tax and penalties > adds expenses, tax and penalties left to right
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/yearFigures.evidence.test.ts:101:55
     99|       // The association is part of the figure: (total + tax) + penalt…
    100|       const b = spendingWithTaxAndPenalties(row(inputs.caseB!))
    101|       expect(Object.is(b, expected.caseBLeftToRight)).toBe(true)
       |                                                       ^
    102|       expect(b).not.toBe(expected.caseBOtherGrouping)
    103|       expect(withinTolerance(b, expected.caseBOtherGrouping!, example.…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/yearFigures.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/yearFigures.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
