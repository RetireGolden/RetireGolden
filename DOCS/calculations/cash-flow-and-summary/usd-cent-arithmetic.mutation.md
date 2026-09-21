# Mutation receipt: usd-cent-arithmetic

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

## Mutation applied to `packages/engine/src/actions/money.ts`

```diff
diff --git a/packages/engine/src/actions/money.ts b/packages/engine/src/actions/money.ts
index 07767ce6..8d99134e 100644
--- a/packages/engine/src/actions/money.ts
+++ b/packages/engine/src/actions/money.ts
@@ -23,7 +23,7 @@ export const asPositiveUsdCents = (value: unknown): PositiveUsdCents =>
   positiveUsdCentsSchema.parse(value)
 
 export function addUsdCents(left: UsdCents, right: UsdCents): UsdCents {
-  return usdCentsSchema.parse(left + right)
+  return usdCentsSchema.parse(left - right)
 }
 
 export function subtractUsdCents(minuend: UsdCents, subtrahend: UsdCents): UsdCents {
```

Subtract instead of adding exact integer cents.

## Command

```
npx.cmd vitest run src/actions/money.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/actions/money.evidence.test.ts (1 test | 1 failed) 5ms
   ❯ usd-cent-arithmetic — Usd cent arithmetic (1)
     × adds, subtracts and sums exact cents to 150, 100 and 200 4ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/actions/money.evidence.test.ts > usd-cent-arithmetic — Usd cent arithmetic > adds, subtracts and sums exact cents to 150, 100 and 200
AssertionError: expected 100 to be 150 // Object.is equality

- Expected
+ Received

- 150
+ 100

 ❯ src/actions/money.evidence.test.ts:13:38
     11|     const left = asUsdCents(example.inputs.left)
     12|     const right = asUsdCents(example.inputs.right)
     13|     expect(addUsdCents(left, right)).toBe(example.expected.addition)
       |                                      ^
     14|     expect(subtractUsdCents(left, right)).toBe(example.expected.subtra…
     15|     expect(sumUsdCents((example.inputs.vector as number[]).map(asUsdCe…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/actions/money.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration. The restored named file passed (exit 0).
