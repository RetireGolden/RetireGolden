# Mutation receipt: simple-candidate-evaluation-comparison

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-twelve` at base `2c07f0d7` and 2026-09-22 against base `fca01300` (pull request #730) as a mutation of `decisions/evaluateCandidate.ts#lastsThroughYear`, which owner decision R15 retired on 2026-09-26; rewritten below for its replacement `projection/moneyLasts.ts#lastFundedYear`, and re-executed 2026-09-26 against RetireGolden base `6b01db8d` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/moneyLasts.ts`

```diff
diff --git a/packages/engine/src/projection/moneyLasts.ts b/packages/engine/src/projection/moneyLasts.ts
index 6bedcb32..203ce744 100644
--- a/packages/engine/src/projection/moneyLasts.ts
+++ b/packages/engine/src/projection/moneyLasts.ts
@@ -42,3 +42,3 @@
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

Re-executed 2026-09-26 for B2-P1 slice 1, whose engine change moved or rewrote the code this receipt mutates, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine4/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (17 tests | 1 failed) 293ms
   ❯ simple-candidate-evaluation-comparison — Simple candidate evaluation comparison (3)
     × sums 20000.75 of candidate conversions and publishes 25250.25, 7500.75 and 2 years 7ms

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)

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
