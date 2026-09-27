# Mutation receipt: scenario-scalar-comparison

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-seven` at base `74916a7e`, and re-executed 2026-09-22 against RetireGolden base `7ae019a8` (branch `claude/b1-p4-cards-seven`, pull request #727), and re-executed 2026-09-26 against RetireGolden base `5d3a72b1` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c780ae5` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `a1fd6d59` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/scenarios/scalarComparison.ts`

```diff
diff --git a/packages/engine/src/scenarios/scalarComparison.ts b/packages/engine/src/scenarios/scalarComparison.ts
index 7c11e69e..64c414cc 100644
--- a/packages/engine/src/scenarios/scalarComparison.ts
+++ b/packages/engine/src/scenarios/scalarComparison.ts
@@ -48,7 +48,7 @@ function finiteComparand(value: number, role: 'baseline' | 'proposal' | 'differe
 export function compareScalars(baseline: number, proposal: number): ScalarComparison {
   const left = finiteComparand(baseline, 'baseline')
   const right = finiteComparand(proposal, 'proposal')
-  return { baseline: left, proposal: right, delta: finiteComparand(right - left, 'difference') }
+  return { baseline: left, proposal: right, delta: finiteComparand(left - right, 'difference') }
 }
 
 /** As `compareScalars` when both sides have a value; otherwise the values as given and a null delta. */
```

Reverse the signed delta to baseline minus proposal. Until B2-P1 slice 3 this was the same change to the private `scalar` helper of `packages/engine/src/scenarios/comparison.ts`; the helper moved, unchanged in its arithmetic, to `scenarios/scalarComparison.ts` as the exported `compareScalars`, so the mutation now applies there.

The assertion this record owns is the one reading `delta: actual 25000, worksheet -25000`; the mutation also breaks the direct case on the exported helper and a sibling record's assertions in the same file, because every one of them reads the mutated expression. The captured output shows every failure in full.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/scenarios/comparisonCells.evidence.test.ts
```

## Captured failing output

The slice 3 review fixes moved compareMoneyLasts and conversionScheduleTotal, rewrote comments in these files and added evidence tests, so the hunk headers and test counts are re-pointed. The baseline is green (comparisonCells.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine11/packages/engine

 ❯ src/scenarios/comparisonCells.evidence.test.ts (6 tests | 4 failed) 68ms
   ❯ scenario-scalar-comparison — Scenario scalar comparison (2)
     × publishes 120000.00, 95000.00 and a signed delta of -25000.00 43ms
     × publishes the same cell from the exported helper, a negative zero as 0, and refuses a non-finite figure 1ms
   ❯ scenario-nullable-scalar-comparison — Scenario nullable scalar comparison (3)
     × subtracts 2041 from 2044 for a delta of exactly 3 years 10ms
     × publishes the same cells from the exported helper, and refuses a non-finite present value 0ms

 Test Files  1 failed (1)
      Tests  4 failed | 2 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/scenarios/comparisonCells.evidence.test.ts > scenario-scalar-comparison — Scenario scalar comparison > publishes 120000.00, 95000.00 and a signed delta of -25000.00
AssertionError: delta: actual 25000, worksheet -25000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/scenarios/comparisonCells.evidence.test.ts:208:9
    206|         withinTolerance(cell.delta, expected.delta, example.tolerance),
    207|         `delta: actual ${cell.delta}, worksheet ${expected.delta}`,
    208|       ).toBe(true)
       |         ^
    209|       // The wrong readings: baseline minus proposal, and a relative c…
    210|       expect(cell.delta).not.toBe(inputs.baseline - inputs.proposal)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/scenarios/comparisonCells.evidence.test.ts > scenario-scalar-comparison — Scenario scalar comparison > publishes the same cell from the exported helper, a negative zero as 0, and refuses a non-finite figure
AssertionError: expected { baseline: 120000, …(2) } to deeply equal { baseline: 120000, …(2) }

- Expected
+ Received

  {
    "baseline": 120000,
-   "delta": -25000,
+   "delta": 25000,
    "proposal": 95000,
  }

 ❯ src/scenarios/comparisonCells.evidence.test.ts:219:64
    217|       const inputs = example.inputs as Record<string, number>
    218|       const expected = example.expected as Record<string, number>
    219|       expect(compareScalars(inputs.baseline, inputs.proposal)).toEqual…
       |                                                                ^
    220|       const zero = compareScalars(-0, -0)
    221|       expect(Object.is(zero.baseline, 0) && Object.is(zero.proposal, 0…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/scenarios/comparisonCells.evidence.test.ts > scenario-nullable-scalar-comparison — Scenario nullable scalar comparison > subtracts 2041 from 2044 for a delta of exactly 3 years
AssertionError: expected -3 to be 3 // Object.is equality

- Expected
+ Received

- 3
+ -3

 ❯ src/scenarios/comparisonCells.evidence.test.ts:262:26
    260|       expect(cell.baseline).toBe(present.baseline)
    261|       expect(cell.proposal).toBe(present.proposal)
    262|       expect(cell.delta).toBe(example.expected.presentDelta)
       |                          ^
    263|     })
    264|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/scenarios/comparisonCells.evidence.test.ts > scenario-nullable-scalar-comparison — Scenario nullable scalar comparison > publishes the same cells from the exported helper, and refuses a non-finite present value
AssertionError: expected { Object (baseline, proposal, ...) } to deeply equal { Object (baseline, proposal, ...) }

- Expected
+ Received

  {
    "baseline": 2041,
-   "delta": 3,
+   "delta": -3,
    "proposal": 2044,
  }

 ❯ src/scenarios/comparisonCells.evidence.test.ts:281:74
    279|
    280|     it('publishes the same cells from the exported helper, and refuses…
    281|       expect(compareNullableScalars(present.baseline, present.proposal…
       |                                                                          ^
    282|         baseline: present.baseline,
    283|         proposal: present.proposal,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/scenarios/scalarComparison.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/scenarios/scalarComparison.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
