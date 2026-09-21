# Mutation receipt: exact-cent-largest-remainder-slices

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

## Mutation applied to `packages/engine/src/actions/exactCentProRata.ts`

```diff
diff --git a/packages/engine/src/actions/exactCentProRata.ts b/packages/engine/src/actions/exactCentProRata.ts
index fa83465d..537072b7 100644
--- a/packages/engine/src/actions/exactCentProRata.ts
+++ b/packages/engine/src/actions/exactCentProRata.ts
@@ -72,7 +72,7 @@ export function exactCentLargestRemainderSlices(
   // Descending exact remainder, then ascending position.
   const ranking = weightMinorUnits.map((_, index) => index).sort((left, right) =>
     remainders[left] === remainders[right]
-      ? left - right
+      ? right - left
       : (remainders[left]! > remainders[right]! ? -1 : 1))
   // Nearest-half-up rounds a part up exactly when its remainder is at least
   // half the denominator, so the rounded-up parts are precisely the front of
```

Reverse equal-remainder ordering, assigning the residual to the last tied position.

## Command

```
npx.cmd vitest run src/actions/exactCentProRata.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/actions/exactCentProRata.evidence.test.ts (3 tests | 1 failed) 5ms
   ❯ exact-cent-largest-remainder-slices — Exact cent largest remainder slices (1)
     × allocates ten cents as 4/3/3 with the tied residual at position zero 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/actions/exactCentProRata.evidence.test.ts > exact-cent-largest-remainder-slices — Exact cent largest remainder slices > allocates ten cents as 4/3/3 with the tied residual at position zero
AssertionError: expected 3n to be 4n // Object.is equality

- Expected
+ Received

- 4n
+ 3n

 ❯ src/actions/exactCentProRata.evidence.test.ts:14:52
     12|     const expected = example.expected.slices as bigint[]
     13|     expect(slices.length).toBe(expected.length)
     14|     slices.forEach((slice, index) => expect(slice).toBe(expected[index…
       |                                                    ^
     15|     expect(slices.reduce((sum, slice) => sum + slice, 0n)).toBe(exampl…
     16|   })
 ❯ src/actions/exactCentProRata.evidence.test.ts:14:12

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/actions/exactCentProRata.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration. The restored named file passed (exit 0).
