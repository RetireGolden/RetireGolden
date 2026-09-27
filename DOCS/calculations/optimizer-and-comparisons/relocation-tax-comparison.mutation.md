# Mutation receipt: relocation-row-comparison

Executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `a1fd6d59` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/relocation.ts`

```diff
diff --git a/packages/engine/src/projection/relocation.ts b/packages/engine/src/projection/relocation.ts
index 98a68fc0..d088dc6a 100644
--- a/packages/engine/src/projection/relocation.ts
+++ b/packages/engine/src/projection/relocation.ts
@@ -608,8 +608,8 @@ export function compareRelocationCandidates(
   for (const { row } of runs) {
     if (row === baselineRow || row.error !== null) continue
     row.lifetimeTaxesAndPenaltiesDeltaVsBaseline = compareScalars(
-      baselineRow.lifetimeTaxesAndPenalties,
       row.lifetimeTaxesAndPenalties,
+      baselineRow.lifetimeTaxesAndPenalties,
     ).delta
   }
 
```

Baseline minus row, the worksheet's first wrong reading: case N's candidate, which pays less lifetime tax, reads +69,919.80, a lower-tax state shown as costlier.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/relocation.comparison.evidence.test.ts
```

## Captured failing output

The slice 3 review fixes moved compareMoneyLasts and conversionScheduleTotal, rewrote comments in these files and added evidence tests, so the hunk headers and test counts are re-pointed. The baseline is green (relocation.comparison.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine11/packages/engine

 ❯ src/projection/relocation.comparison.evidence.test.ts (3 tests | 1 failed) 15ms
   ❯ relocation-row-comparison — Relocation rows compared with your plan (3)
     × case N: each row publishes its lifetime sum minus the baseline row's, and case O: none on the baseline or a failed row 13ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/relocation.comparison.evidence.test.ts > relocation-row-comparison — Relocation rows compared with your plan > case N: each row publishes its lifetime sum minus the baseline row's, and case O: none on the baseline or a failed row
AssertionError: caseN: 69919.80000000005: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/relocation.comparison.evidence.test.ts:129:102
    127|       const [baseline, florida, failed] = comparison.rows
    128|       const delta = florida!.lifetimeTaxesAndPenaltiesDeltaVsBaseline!
    129|       expect(withinTolerance(delta, expected.caseN as number, example.…
       |                                                                                                      ^
    130|       expect(bits(delta)).toBe(expected.caseNBits)
    131|       // The wrong reading: baseline minus row shows the lower-tax sta…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/relocation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/relocation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
