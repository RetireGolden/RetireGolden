# Mutation receipt: spending-layer-shortfall-attribution

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

## Mutation applied to `packages/engine/src/spending/layers.ts`

```diff
diff --git a/packages/engine/src/spending/layers.ts b/packages/engine/src/spending/layers.ts
index 5cebc894..873c8fff 100644
--- a/packages/engine/src/spending/layers.ts
+++ b/packages/engine/src/spending/layers.ts
@@ -112,7 +112,7 @@ export function attributeShortfall(input: ShortfallAttributionInput): ShortfallA
   const idealFunded = Math.max(0, Math.min(idealSpending, actualFunded - targetSpending))
   const excessFunded = Math.max(0, Math.min(excessSpending, actualFunded - targetSpending - idealSpending))
   return {
-    requiredShortfall: Math.max(0, requiredSpending - actualFunded),
+    requiredShortfall: Math.max(0, input.withdrawalShortfall),
     targetShortfall: Math.max(0, targetSpending - actualFunded),
     idealShortfall: Math.max(0, idealSpending - idealFunded),
     excessShortfall: Math.max(0, excessSpending - excessFunded),
```

Charge all withdrawal shortfall to the required floor, ignoring funded discretionary dollars. The previously passing required-shortfall assertion independently kills this mutation.

## Command

```
npx.cmd vitest run src/spending/layers.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/spending/layers.evidence.test.ts (4 tests | 2 failed) 5ms
   ❯ spending-layer-shortfall-attribution — Spending layer shortfall attribution (3)
     × attributes zero required shortfall 3ms
     × attributes worksheet target shortfall 15 (production discrepancy remains visible) 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/spending/layers.evidence.test.ts > spending-layer-shortfall-attribution — Spending layer shortfall attribution > attributes zero required shortfall
AssertionError: requiredShortfall: actual 5, worksheet 0: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/spending/layers.evidence.test.ts:31:190
     29|   it('attributes zero required shortfall', () => {
     30|     const actual = attributeShortfall(example.inputs as unknown as Sho…
     31|     expect(withinTolerance(actual, example.expected.requiredShortfall …
       |                                                                                                                                                                                              ^
     32|   })
     33|   it('attributes worksheet target shortfall 15 (production discrepancy…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/spending/layers.evidence.test.ts > spending-layer-shortfall-attribution — Spending layer shortfall attribution > attributes worksheet target shortfall 15 (production discrepancy remains visible)
AssertionError: targetShortfall: actual 20, worksheet 15: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/spending/layers.evidence.test.ts:35:184
     33|   it('attributes worksheet target shortfall 15 (production discrepancy…
     34|     const actual = attributeShortfall(example.inputs as unknown as Sho…
     35|     expect(withinTolerance(actual, example.expected.targetShortfall as…
       |                                                                                                                                                                                        ^
     36|   })
     37|   it('attributes ideal and excess shortfalls 20 and 10', () => {

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/spending/layers.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration. The restored named file exits 1 solely for the preserved worksheet discrepancy: targetShortfall actual 20 versus worksheet 15. Captured restored failure: AssertionError: targetShortfall: actual 20, worksheet 15: expected false to be true // Object.is equality
