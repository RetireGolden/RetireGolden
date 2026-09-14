# Mutation receipt: fedinvest-nearest-tips-maturity

Executed 2026-09-14 against RetireGolden base `e594ac64` (branch claude/b1-p4-cards-ladders) in `packages/engine`, after the worksheet was re-derived with the one-year window stated.

## Mutation applied to `packages/engine/src/ladder/fedInvest.ts`

```diff
-  ... bestDistance <= 1 ...
+  ... true /* mutation: no window */ ...
```

This removes the one-year window, the worksheet's first wrong reading: case B (candidates 2030 and 2035 for target 2033) then returns the 2035 row instead of null.

## Command

```
npx vitest run src/ladder/fedInvest.evidence.test.ts
```

## Captured failing output

```
     × case B: returns null when the nearest candidate is two years away (2030/2035 for 2033) 2ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-nearest-tips-maturity — Nearest FedInvest TIPS for a rung year > case B: returns null when the nearest candidate is two years away (2030/2035 for 2033)
AssertionError: expected 'T2035' to be null // Object.is equality
    112|       // First derivation expected the 2035 row here; the one-year win…
 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
```

## Revert

`git checkout -- packages/engine/src/ladder/fedInvest.ts`; `git diff --quiet -- packages/engine/src/ladder/fedInvest.ts` confirmed no change to production code after the run.
