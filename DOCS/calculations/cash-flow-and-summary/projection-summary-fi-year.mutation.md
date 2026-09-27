# Mutation receipt: projection-summary-fi-year

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-26 against RetireGolden base `94954596` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/compare.ts`

```diff
@@ -354,7 +354,7 @@
   let fiAge: number | null = null
   for (const y of result.years) {
     const deflatedInvestable = y.investableTotal / Math.pow(1 + inflationRate, y.year - startYear)
-    if (deflatedInvestable >= fiNumber) {
+    if (deflatedInvestable > fiNumber) {
       fiYear = y.year
       fiAge = y.year - birthYear
       break
```

This makes the crossing comparison strict, so the first crossing moves from 2027 to 2028 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/compareSummary.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (compareSummary.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/projection/compareSummary.evidence.test.ts (19 tests | 2 failed) 22ms
   ❯ projection-summary-fi-age — Projection summary fi age (2)
     × crosses inclusively in 2027 at age 47 and ignores the later sentinel row 4ms
   ❯ projection-summary-fi-year — First financial-independence crossing year (2)
     × crosses inclusively in 2027 and never waits for the larger 2028 row 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 17 passed (19)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-age — Projection summary fi age > crosses inclusively in 2027 at age 47 and ignores the later sentinel row
AssertionError: expected 2028 to be 2027 // Object.is equality

- Expected
+ Received

- 2027
+ 2028

 ❯ src/projection/compareSummary.evidence.test.ts:330:30
    328|         `upstream fiNumber: actual ${summary.fiNumber}, worksheet ${St…
    329|       ).toBe(true)
    330|       expect(summary.fiYear).toBe(example.expected.fiYear)
       |                              ^
    331|       expect(summary.fiAge).toBe(example.expected.fiAge)
    332|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/compareSummary.evidence.test.ts > projection-summary-fi-year — First financial-independence crossing year > crosses inclusively in 2027 and never waits for the larger 2028 row
AssertionError: expected 2028 to be 2027 // Object.is equality

- Expected
+ Received

- 2027
+ 2028

 ❯ src/projection/compareSummary.evidence.test.ts:844:30
    842|         `fiNumber: actual ${summary.fiNumber}, worksheet ${inputs.fiNu…
    843|       ).toBe(true)
    844|       expect(summary.fiYear).toBe(expected.crossingFiYear)
       |                              ^
    845|       // The worksheet's three wrong readings all land on 2028.
    846|       expect(summary.fiYear).not.toBe(expected.strictComparisonWrongRe…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/compare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/compare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
