# Mutation receipt: display-upside-spending-annual

Executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/yearFigures.ts`

```diff
diff --git a/packages/engine/src/projection/yearFigures.ts b/packages/engine/src/projection/yearFigures.ts
index 9568201b..a0adb5fa 100644
--- a/packages/engine/src/projection/yearFigures.ts
+++ b/packages/engine/src/projection/yearFigures.ts
@@ -77,3 +77,3 @@
 export function upsideSpending(year: { readonly expenses: Pick<YearExpenses, 'idealSpending' | 'excessSpending'> }): number {
-  return year.expenses.idealSpending + year.expenses.excessSpending
+  return year.expenses.idealSpending
 }
```

Publishes the ideal layer alone, the worksheet's first wrong reading: case A then reads 12,000.40 instead of 15,000.75.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/yearFigures.evidence.test.ts
```

## Captured failing output

The baseline is green (yearFigures.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine4/packages/engine

 ❯ src/projection/yearFigures.evidence.test.ts (13 tests | 1 failed) 44ms
   ❯ display-upside-spending-annual — Upside spending: intended spending above the target layer (1)
     × adds the ideal and excess layers 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/yearFigures.evidence.test.ts > display-upside-spending-annual — Upside spending: intended spending above the target layer > adds the ideal and excess layers
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/yearFigures.evidence.test.ts:205:103
    203|     const row = (r: Row) => ({ expenses: { idealSpending: r.idealSpend…
    204|     it('adds the ideal and excess layers', () => {
    205|       expect(withinTolerance(upsideSpending(row(inputs.caseA!)), expec…
       |                                                                                                       ^
    206|       expect(withinTolerance(upsideSpending(row(inputs.caseA!)), expec…
    207|       const b = upsideSpending(row(inputs.caseB!))

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/yearFigures.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/yearFigures.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
