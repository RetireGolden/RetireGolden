# Mutation receipt: display-upside-shortfall-annual

Executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/yearFigures.ts`

```diff
diff --git a/packages/engine/src/projection/yearFigures.ts b/packages/engine/src/projection/yearFigures.ts
index 9568201b..b7bc0e8d 100644
--- a/packages/engine/src/projection/yearFigures.ts
+++ b/packages/engine/src/projection/yearFigures.ts
@@ -82,3 +82,3 @@
 export function upsideShortfall(year: Pick<YearResult, 'idealShortfall' | 'excessShortfall'>): number {
-  return year.idealShortfall + year.excessShortfall
+  return year.idealShortfall
 }
```

Drops the excess miss: case A then reads 4,200 instead of 7,200.35.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/yearFigures.evidence.test.ts
```

## Captured failing output

The baseline is green (yearFigures.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/yearFigures.evidence.test.ts (13 tests | 1 failed) 45ms
   ❯ display-upside-shortfall-annual — Upside miss: upside spending not funded (1)
     × adds the ideal and excess misses and leaves the lower layers out 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/yearFigures.evidence.test.ts > display-upside-shortfall-annual — Upside miss: upside spending not funded > adds the ideal and excess misses and leaves the lower layers out
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/yearFigures.evidence.test.ts:235:104
    233|     const row = (r: Row) => ({ idealShortfall: r.idealShortfall!, exce…
    234|     it('adds the ideal and excess misses and leaves the lower layers o…
    235|       expect(withinTolerance(upsideShortfall(row(inputs.caseA!)), expe…
       |                                                                                                        ^
    236|       const b = inputs.caseB!
    237|       const upsideB = upsideShortfall(row(b))

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/yearFigures.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/yearFigures.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
