# Mutation receipt: display-tax-plus-penalties-annual

Executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/yearFigures.ts`

```diff
diff --git a/packages/engine/src/projection/yearFigures.ts b/packages/engine/src/projection/yearFigures.ts
index 9568201b..241472ad 100644
--- a/packages/engine/src/projection/yearFigures.ts
+++ b/packages/engine/src/projection/yearFigures.ts
@@ -40,3 +40,3 @@
 export function taxAndPenalties(year: Pick<YearResult, 'tax' | 'penalties'>): number {
-  return year.tax + year.penalties
+  return year.tax
 }
```

Publishes the tax alone, the worksheet's first wrong reading: case A then reads 18,742, hiding the $2,000 penalty, instead of 20,742.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/yearFigures.evidence.test.ts
```

## Captured failing output

The baseline is green (yearFigures.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine4/packages/engine

 ❯ src/projection/yearFigures.evidence.test.ts (13 tests | 1 failed) 54ms
   ❯ display-tax-plus-penalties-annual — Tax plus penalties for the year (1)
     × adds the settled tax and the penalties, and never adds AMT a second time 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/yearFigures.evidence.test.ts > display-tax-plus-penalties-annual — Tax plus penalties for the year > adds the settled tax and the penalties, and never adds AMT a second time
AssertionError: caseA: 18742: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/yearFigures.evidence.test.ts:60:95
     58|       for (const key of ['caseA', 'caseB', 'caseC'] as const) {
     59|         const value = taxAndPenalties(inputs[key] as { tax: number; pe…
     60|         expect(withinTolerance(value, expected[key]!, example.toleranc…
       |                                                                                               ^
     61|       }
     62|       expect(Object.is(taxAndPenalties({ tax: 18_742, penalties: 2_000…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/yearFigures.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/yearFigures.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
