# Mutation receipt: exact-cent-rational-half-up

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

## Mutation applied to `packages/engine/src/actions/exactCentProRata.ts`

```diff
diff --git a/packages/engine/src/actions/exactCentProRata.ts b/packages/engine/src/actions/exactCentProRata.ts
index fa83465d..9a834d99 100644
--- a/packages/engine/src/actions/exactCentProRata.ts
+++ b/packages/engine/src/actions/exactCentProRata.ts
@@ -39,7 +39,7 @@ export function exactCentNearestHalfUp(
   numeratorMinorUnits: bigint,
   denominatorMinorUnits: bigint,
 ): bigint {
-  return exactCentProRataNearestHalfUp(numeratorMinorUnits, 1n, denominatorMinorUnits)
+  return exactCentProRataNearestHalfUp(numeratorMinorUnits * 2n, 1n, denominatorMinorUnits)
 }
 
 /**
```

Double the rational numerator before rounding instead of rounding the supplied quantity.

## Command

```
npx.cmd vitest run src/actions/exactCentProRata.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/actions/exactCentProRata.evidence.test.ts (3 tests | 1 failed) 5ms
   ❯ exact-cent-rational-half-up — Exact cent rational half up (1)
     × rounds the exact rational 5/2 cents upward to 3 cents 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/actions/exactCentProRata.evidence.test.ts > exact-cent-rational-half-up — Exact cent rational half up > rounds the exact rational 5/2 cents upward to 3 cents
AssertionError: expected 5n to be 3n // Object.is equality

- Expected
+ Received

- 3n
+ 5n

 ❯ src/actions/exactCentProRata.evidence.test.ts:35:110
     33| }, ({ example }) => {
     34|   it('rounds the exact rational 5/2 cents upward to 3 cents', () => {
     35|     expect(exactCentNearestHalfUp(example.inputs.numerator as bigint, …
       |                                                                                                              ^
     36|   })
     37| })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/actions/exactCentProRata.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration. The restored named file passed (exit 0).
