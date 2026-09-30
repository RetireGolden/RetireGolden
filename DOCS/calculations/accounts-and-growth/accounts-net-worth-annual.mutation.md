# Mutation receipt: accounts-net-worth-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualSnapshot.ts`

```diff
@@ -108,7 +108,7 @@ export function annualSnapshot(input: AnnualSnapshotInput): AnnualSnapshot {
   let hecmEffectiveDebt = 0
   for (const [id, line] of hecmStates) {
     hecmLoanTotal += line.loanBalance
-    hecmEffectiveDebt += Math.min(line.loanBalance, propertyValues.get(id) ?? 0)
+    hecmEffectiveDebt += line.loanBalance
   }
   let insuranceCashValueTotal = 0
   for (const [id, value] of insuranceCashValues) {
```

This drops the non-recourse cap, deducting the uncapped $470,000 of HECM balances and publishing $594,000 of net worth — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualYearResultAssembly.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (annualYearResultAssembly.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/internal/annualYearResultAssembly.evidence.test.ts (7 tests | 1 failed) 31ms
   ❯ accounts-net-worth-annual — Annual net worth, with the non-recourse HECM cap (2)
     × caps each HECM at its own home and composes 664000 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualYearResultAssembly.evidence.test.ts > accounts-net-worth-annual — Annual net worth, with the non-recourse HECM cap > caps each HECM at its own home and composes 664000
AssertionError: hecmEffectiveDebt 470000 is not within {"abs":0.005} of the worksheet's 400000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualYearResultAssembly.evidence.test.ts:145:5
    143|     withinTolerance(actual, target, tolerance),
    144|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
    145|   ).toBe(true)
       |     ^
    146| }
    147|
 ❯ src/projection/internal/annualYearResultAssembly.evidence.test.ts:212:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualSnapshot.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualSnapshot.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
