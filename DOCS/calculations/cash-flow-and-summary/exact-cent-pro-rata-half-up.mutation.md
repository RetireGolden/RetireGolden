# Mutation receipt: exact-cent-pro-rata-half-up

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

## Mutation applied to `packages/engine/src/actions/exactCentProRata.ts`

```diff
diff --git a/packages/engine/src/actions/exactCentProRata.ts b/packages/engine/src/actions/exactCentProRata.ts
index fa83465d..31495c8d 100644
--- a/packages/engine/src/actions/exactCentProRata.ts
+++ b/packages/engine/src/actions/exactCentProRata.ts
@@ -16,7 +16,7 @@ export function exactCentProRataNearestHalfUp(
   const quotient = numerator / ratioDenominatorMinorUnits
   const remainder = numerator % ratioDenominatorMinorUnits
   return quotient +
-    (remainder * 2n >= ratioDenominatorMinorUnits ? 1n : 0n)
+    (remainder * 2n > ratioDenominatorMinorUnits ? 1n : 0n)
 }
 
 /**
```

Round an exact half downward by excluding equality.

## Command

```
npx.cmd vitest run src/actions/exactCentProRata.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/actions/exactCentProRata.evidence.test.ts (3 tests | 2 failed) 5ms
   ❯ exact-cent-pro-rata-half-up — Exact cent pro rata half up (1)
     × rounds half of 101 cents upward to 51 cents 3ms
   ❯ exact-cent-rational-half-up — Exact cent rational half up (1)
     × rounds the exact rational 5/2 cents upward to 3 cents 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/actions/exactCentProRata.evidence.test.ts > exact-cent-pro-rata-half-up — Exact cent pro rata half up > rounds half of 101 cents upward to 51 cents
AssertionError: expected 50n to be 51n // Object.is equality

- Expected
+ Received

- 51n
+ 50n

 ❯ src/actions/exactCentProRata.evidence.test.ts:25:150
     23| }, ({ example }) => {
     24|   it('rounds half of 101 cents upward to 51 cents', () => {
     25|     expect(exactCentProRataNearestHalfUp(example.inputs.amount as bigi…
       |                                                                                                                                                      ^
     26|   })
     27| })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/actions/exactCentProRata.evidence.test.ts > exact-cent-rational-half-up — Exact cent rational half up > rounds the exact rational 5/2 cents upward to 3 cents
AssertionError: expected 2n to be 3n // Object.is equality

- Expected
+ Received

- 3n
+ 2n

 ❯ src/actions/exactCentProRata.evidence.test.ts:35:110
     33| }, ({ example }) => {
     34|   it('rounds the exact rational 5/2 cents upward to 3 cents', () => {
     35|     expect(exactCentNearestHalfUp(example.inputs.numerator as bigint, …
       |                                                                                                              ^
     36|   })
     37| })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/actions/exactCentProRata.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration. The restored named file passed (exit 0).
