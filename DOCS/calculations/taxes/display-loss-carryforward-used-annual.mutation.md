# Mutation receipt: display-loss-carryforward-used-annual

Executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/yearFigures.ts`

```diff
diff --git a/packages/engine/src/projection/yearFigures.ts b/packages/engine/src/projection/yearFigures.ts
index 9568201b..735f4243 100644
--- a/packages/engine/src/projection/yearFigures.ts
+++ b/packages/engine/src/projection/yearFigures.ts
@@ -93,3 +93,3 @@
 ): number {
-  return year.capitalLossUsedAgainstGains + year.capitalLossUsedAgainstOrdinary
+  return year.capitalLossUsedAgainstOrdinary
 }
```

Counts only the part used against ordinary income, the worksheet's third wrong reading: case A then reads 3,000 instead of 7,000.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/yearFigures.evidence.test.ts
```

## Captured failing output

The baseline is green (yearFigures.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/yearFigures.evidence.test.ts (13 tests | 1 failed) 53ms
   ❯ display-loss-carryforward-used-annual — Capital-loss carryforward used in the year (1)
     × adds the carryforward used against gains and against ordinary income, through the engine's own netting 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/yearFigures.evidence.test.ts > display-loss-carryforward-used-annual — Capital-loss carryforward used in the year > adds the carryforward used against gains and against ordinary income, through the engine's own netting
AssertionError: caseA: expected 3000 to be 7000 // Object.is equality

- Expected
+ Received

- 7000
+ 3000

 ❯ src/projection/yearFigures.evidence.test.ts:284:27
    282|           capitalLossUsedAgainstOrdinary: netting.usedAgainstOrdinary,
    283|         })
    284|         expect(used, key).toBe(expected[key])
       |                           ^
    285|         if (key === 'caseA') expect(used).not.toBe(netting.remaining)
    286|         if (key === 'caseC') {

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/yearFigures.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/yearFigures.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
