# Mutation receipt: ladder-income-yield

Executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b6d48615` (branch `claude/decided-small-items`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/ladderMath.ts`

```diff
diff --git a/packages/engine/src/ladder/ladderMath.ts b/packages/engine/src/ladder/ladderMath.ts
index 19c7a7c0..5dd6c58f 100644
--- a/packages/engine/src/ladder/ladderMath.ts
+++ b/packages/engine/src/ladder/ladderMath.ts
@@ -223,5 +223,5 @@
     )
   }
-  return (build.targetAnnualRealIncome / build.totalCost) * 100
+  return (build.totalCost / build.targetAnnualRealIncome) * 100
 }
 
```

Divides cost by income, the worksheet's first wrong reading: case B reads 194.16, a years-of-income figure, instead of 51.50 percent of cost per year.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/ladder/ladderMath.incomeYield.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 for decision D-TREASURY: the embedded Treasury row became the official 2026-06-30 row, which changed this receipt's evidence file or moved the lines it mutates, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (ladderMath.incomeYield.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine10/packages/engine

 ❯ src/ladder/ladderMath.incomeYield.evidence.test.ts (7 tests | 3 failed) 45ms
   ❯ ladder-income-yield — Ladder income as a percent of its cost (7)
     × cases A to C: income over cost, × 100, on synthetic curves 4ms
     × case D: a plan ladder already owned is quoted on the ledger window, anchored the year before the projection 1ms
     × computes income over cost, then × 100: the other order misses case C in the last digit 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ladder/ladderMath.incomeYield.evidence.test.ts > ladder-income-yield — Ladder income as a percent of its cost > cases A to C: income over cost, × 100, on synthetic curves
AssertionError: caseA yield: 98.0392156862745 against the worksheet's 102: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ near src/ladder/ladderMath.incomeYield.evidence.test.ts:52:123
     50|     const expected = example.expected as Record<string, Record<string,…
     51|     const near = (actual: number, target: number, label: string) =>
     52|       expect(withinTolerance(actual, target, example.tolerance), `${la…
       |                                                                                                                           ^
     53|
     54|     it('cases A to C: income over cost, × 100, on synthetic curves', (…
 ❯ src/ladder/ladderMath.incomeYield.evidence.test.ts:61:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/ladder/ladderMath.incomeYield.evidence.test.ts > ladder-income-yield — Ladder income as a percent of its cost > case D: a plan ladder already owned is quoted on the ledger window, anchored the year before the projection
AssertionError: caseD yield: 1585.4225903162935 against the worksheet's 6.307466577731172: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ near src/ladder/ladderMath.incomeYield.evidence.test.ts:52:123
     50|     const expected = example.expected as Record<string, Record<string,…
     51|     const near = (actual: number, target: number, label: string) =>
     52|       expect(withinTolerance(actual, target, example.tolerance), `${la…
       |                                                                                                                           ^
     53|
     54|     it('cases A to C: income over cost, × 100, on synthetic curves', (…
 ❯ src/ladder/ladderMath.incomeYield.evidence.test.ts:88:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/ladder/ladderMath.incomeYield.evidence.test.ts > ladder-income-yield — Ladder income as a percent of its cost > computes income over cost, then × 100: the other order misses case C in the last digit
AssertionError: expected 200.49906406006227 to be 49.875544541217224 // Object.is equality

- Expected
+ Received

- 49.875544541217224
+ 200.49906406006227

 ❯ src/ladder/ladderMath.incomeYield.evidence.test.ts:96:24
     94|       const c = expected.caseC!
     95|       const yieldPct = ladderIncomeYieldPct({ targetAnnualRealIncome: …
     96|       expect(yieldPct).toBe(expected.caseCExact)
       |                        ^
     97|       expect((20_000 * 100) / (c.totalCost as number)).toBe(expected.c…
     98|       expect(yieldPct).not.toBe(expected.caseCOtherAssociation)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/ladder/ladderMath.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/ladder/ladderMath.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
