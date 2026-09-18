# Mutation receipt: spending-layer-shortfall-attribution

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

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

Charge all withdrawal shortfall to the required floor, ignoring funded discretionary dollars. The required-miss test kills it in the guardrail-cut case (actual 5, worksheet 0).

## Command

```
npx.cmd vitest run src/spending/layers.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-18 after the worksheet re-derivation, so the baseline is green (4 tests pass on unmodified production) and the one failure below is the mutation's. Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/spending/layers.evidence.test.ts (4 tests | 1 failed) 5ms
   ❯ spending-layer-shortfall-attribution — Spending layer shortfall attribution (3)
     × attributes the required miss as the floor less actually funded dollars: 0 for the cut alone, 3 when cut and shortfall breach the floor 3ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/spending/layers.evidence.test.ts > spending-layer-shortfall-attribution — Spending layer shortfall attribution > attributes the required miss as the floor less actually funded dollars: 0 for the cut alone, 3 when cut and shortfall breach the floor
AssertionError: guardrailCut requiredShortfall: actual 5, worksheet 0: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ check src/spending/layers.evidence.test.ts:41:142
     39|   const check = (c: (typeof cases)[number], key: keyof ShortfallAttrib…
     40|     const actual = attributeShortfall(inputsOf(c))[key]
     41|     expect(withinTolerance(actual, expectedOf(c)[key], example.toleran…
       |                                                                                                                                              ^
     42|   }
     43|   // One test per layer rule, so a mutation of one rule fails by name.
 ❯ src/spending/layers.evidence.test.ts:45:28

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/spending/layers.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration. The restored named file exits 1 solely for the preserved worksheet discrepancy: targetShortfall actual 20 versus worksheet 15. Captured restored failure: AssertionError: targetShortfall: actual 20, worksheet 15: expected false to be true // Object.is equality
