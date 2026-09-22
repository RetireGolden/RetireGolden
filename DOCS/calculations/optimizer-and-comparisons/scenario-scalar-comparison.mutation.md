# Mutation receipt: scenario-scalar-comparison

Executed 2026-09-18 against RetireGolden base `74916a7e` (branch `claude/b1-p4-cards-slice-seven`) in `packages/engine`.

## Mutation applied to `packages/engine/src/scenarios/comparison.ts`

```diff
diff --git a/packages/engine/src/scenarios/comparison.ts b/packages/engine/src/scenarios/comparison.ts
index 52c98783..2a9069cd 100644
--- a/packages/engine/src/scenarios/comparison.ts
+++ b/packages/engine/src/scenarios/comparison.ts
@@ -316,7 +316,7 @@ function safeNumber(value: number): number {
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

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s7/packages/engine

 ❯ src/scenarios/comparisonCells.evidence.test.ts (4 tests | 2 failed) 72ms
   ❯ scenario-scalar-comparison — Scenario scalar comparison (1)
     × publishes 120000.00, 95000.00 and a signed delta of -25000.00 47ms
   ❯ scenario-nullable-scalar-comparison — Scenario nullable scalar comparison (2)
     × subtracts 2041 from 2044 for a delta of exactly 3 years 11ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)

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

`git checkout -- packages/engine/src/scenarios/comparison.ts` restored the exact original bytes (compared byte for byte in the harness), and `git diff --quiet -- packages/engine/src/scenarios/comparison.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (exit 0).
