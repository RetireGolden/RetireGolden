# Mutation receipt: spending-layer-shortfall-attribution

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

Second re-execution: Re-executed 2026-09-18 after the worksheet extension.

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
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/spending/layers.evidence.test.ts
```

## Captured failing output

The unmodified baseline passed (exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Mutation exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/spending/layers.evidence.test.ts (5 tests | 1 failed) 5ms
   ❯ spending-layer-shortfall-attribution — Spending layer shortfall attribution (4)
     × attributes the required miss as the floor less actually funded dollars: 0 for the cut alone, 3 when cut and shortfall breach the floor 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/spending/layers.evidence.test.ts > spending-layer-shortfall-attribution — Spending layer shortfall attribution > attributes the required miss as the floor less actually funded dollars: 0 for the cut alone, 3 when cut and shortfall breach the floor
AssertionError: guardrailCut requiredShortfall: actual 5, worksheet 0: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ check src/spending/layers.evidence.test.ts:43:142
     41|   const check = (c: (typeof cases)[number], key: keyof ShortfallAttrib…
     42|     const actual = attributeShortfall(inputsOf(c))[key]
     43|     expect(withinTolerance(actual, expectedOf(c)[key], example.toleran…
       |                                                                                                                                              ^
     44|   }
     45|   // One test per layer rule, so a mutation of one rule fails by name.
 ❯ src/spending/layers.evidence.test.ts:47:28

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Ran `git checkout -- packages/engine/src/spending/layers.ts`, then `git diff --quiet -- packages/engine/src/spending/layers.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite passed (exit 0). The baseline and restored suite are green; no discrepancy remains.
