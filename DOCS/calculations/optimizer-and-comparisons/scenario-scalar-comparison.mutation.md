# Mutation receipt: scenario-scalar-comparison

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-26 against RetireGolden base `5d3a72b1` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c780ae5` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/scenarios/comparison.ts`

```diff
diff --git a/packages/engine/src/scenarios/comparison.ts b/packages/engine/src/scenarios/comparison.ts
index 53c10ca7..005b8a5d 100644
--- a/packages/engine/src/scenarios/comparison.ts
+++ b/packages/engine/src/scenarios/comparison.ts
@@ -356,7 +356,7 @@ function safeNumber(value: number): number {
 function scalar(baseline: number, proposal: number): ScalarComparison {
   const left = safeNumber(baseline)
   const right = safeNumber(proposal)
-  return { baseline: left, proposal: right, delta: safeNumber(right - left) }
+  return { baseline: left, proposal: right, delta: safeNumber(left - right) }
 }

 function nullableScalar(baseline: number | null, proposal: number | null): NullableScalarComparison {
```

Reverse the signed delta to baseline minus proposal.

The assertion this record owns is the one reading `delta: actual 25000, worksheet -25000`; the mutation also breaks a sibling record's assertion in the same file, because both read the mutated expression. The captured output shows every failure in full.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/scenarios/comparisonCells.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after merging RetireGolden #751 into B2-P1 slice 2: the drift check #751 adds flagged this receipt against the slice's code (a hunk header naming a line the code has moved from, a context line the slice changed, a header naming no line, or a stated test count the slice's evidence file no longer has), so the diff header, capture, blob hash and revert note are refreshed against this head. The baseline is green (comparisonCells.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/scenarios/comparisonCells.evidence.test.ts (4 tests | 2 failed) 69ms
   ❯ scenario-scalar-comparison — Scenario scalar comparison (1)
     × publishes 120000.00, 95000.00 and a signed delta of -25000.00 44ms
   ❯ scenario-nullable-scalar-comparison — Scenario nullable scalar comparison (2)
     × subtracts 2041 from 2044 for a delta of exactly 3 years 11ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/scenarios/comparisonCells.evidence.test.ts > scenario-scalar-comparison — Scenario scalar comparison > publishes 120000.00, 95000.00 and a signed delta of -25000.00
AssertionError: delta: actual 25000, worksheet -25000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/scenarios/comparisonCells.evidence.test.ts:207:9
    205|         withinTolerance(cell.delta, expected.delta, example.tolerance),
    206|         `delta: actual ${cell.delta}, worksheet ${expected.delta}`,
    207|       ).toBe(true)
       |         ^
    208|       // The wrong readings: baseline minus proposal, and a relative c…
    209|       expect(cell.delta).not.toBe(inputs.baseline - inputs.proposal)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/scenarios/comparisonCells.evidence.test.ts > scenario-nullable-scalar-comparison — Scenario nullable scalar comparison > subtracts 2041 from 2044 for a delta of exactly 3 years
AssertionError: expected -3 to be 3 // Object.is equality

- Expected
+ Received

- 3
+ -3

 ❯ src/scenarios/comparisonCells.evidence.test.ts:248:26
    246|       expect(cell.baseline).toBe(present.baseline)
    247|       expect(cell.proposal).toBe(present.proposal)
    248|       expect(cell.delta).toBe(example.expected.presentDelta)
       |                          ^
    249|     })
    250|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/scenarios/comparison.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/scenarios/comparison.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
