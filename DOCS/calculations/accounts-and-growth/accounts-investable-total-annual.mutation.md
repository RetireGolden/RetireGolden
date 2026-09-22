# Mutation receipt: accounts-investable-total-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualSnapshot.ts`

```diff
@@ -112,6 +112,7 @@ export function annualSnapshot(input: AnnualSnapshotInput): AnnualSnapshot {
   for (const [id, value] of insuranceCashValues) {
     balanceEntries.push([id, value])
     insuranceCashValueTotal += value
+    investableTotal += value
   }
 
   return {
```

This folds permanent-life cash value into the investable total, publishing $604,000 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSnapshot.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualSnapshot.evidence.test.ts > accounts-investable-total-annual — Annual investable total > folds the seven investable members to 592000 and leaves the other three channels out
AssertionError: investableTotal: actual 604000, worksheet 592000: expected false to be true // Object.is equality
 FAIL  src/projection/internal/annualSnapshot.evidence.test.ts > accounts-investable-total-annual — Annual investable total > publishes the same member list on a real projection, excluding policy cash value and property
AssertionError: investableTotal: actual 602000, six worksheet members 590000: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualSnapshot.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualSnapshot.ts` exited 0, confirming no change to production code after the run.
