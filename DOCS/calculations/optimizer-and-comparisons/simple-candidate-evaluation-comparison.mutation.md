# Mutation receipt: simple-candidate-evaluation-comparison

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-twelve` at base `2c07f0d7` and 2026-09-22 against base `fca01300` (pull request #730) as a mutation of `decisions/evaluateCandidate.ts#lastsThroughYear`, which owner decision R15 retired on 2026-09-26; rewritten below for its replacement `projection/moneyLasts.ts#lastFundedYear`, and re-executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `b775e5df` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `a1fd6d59` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1176b2e5` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `dc0c6c3f` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/moneyLasts.ts`

```diff
diff --git a/packages/engine/src/projection/moneyLasts.ts b/packages/engine/src/projection/moneyLasts.ts
index dafbd67c..a09cbaff 100644
--- a/packages/engine/src/projection/moneyLasts.ts
+++ b/packages/engine/src/projection/moneyLasts.ts
@@ -43,3 +43,3 @@
 export function lastFundedYear(result: Pick<ProjectionResult, 'depletionYear' | 'endYear'>): number {
-  return result.depletionYear === null ? result.endYear : result.depletionYear - 1
+  return result.depletionYear === null ? result.endYear : result.depletionYear
 }
```

Counts a depleting result as funded through its depletion year while a non-depleting one is funded through its `endYear`, the worksheet's second wrong reading as restated for owner decision R15: the baseline (depleting in 2034) then lasts through 2034 against the candidate's 2035, so the money-lasts delta is `2035 - 2034 = 1` year instead of `2`.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/optimizePlan.evidence.test.ts
```

## Captured failing output

the merge of slice 4's final head (slice 3 #754, #755, #756, the claimants split) moved the production lines and test titles these receipts quote The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine16/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (23 tests | 1 failed) 891ms
   ❯ simple-candidate-evaluation-comparison — Simple candidate evaluation comparison (3)
     × sums 20000.75 of candidate conversions and publishes 25250.25, 7500.75 and 2 years 7ms

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > simple-candidate-evaluation-comparison — Simple candidate evaluation comparison > sums 20000.75 of candidate conversions and publishes 25250.25, 7500.75 and 2 years
AssertionError: expected 1 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 1

 ❯ src/projection/optimizePlan.evidence.test.ts:582:40
    580|       // against the baseline's 2034 depletion year; using endYear its…
    581|       // worksheet's wrong reading, would publish 1.
    582|       expect(row.moneyLastsYearsDelta).toBe(example.expected.moneyLast…
       |                                        ^
    583|       // The reversed-subtraction wrong readings.
    584|       expect(row.afterTaxEstateDelta).not.toBe(-expectedEstate)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/moneyLasts.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/moneyLasts.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
