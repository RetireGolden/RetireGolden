# Mutation receipt: market-model-reversed-history

Executed 2026-09-26 against RetireGolden base `8ff951e4` (branch claude/monte-carlo-models) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/marketModels.ts`

```diff
--- a/packages/engine/src/montecarlo/marketModels.ts
+++ b/packages/engine/src/montecarlo/marketModels.ts
@@ mutation @@
-  const winLen = config.windowLengthYears ?? 10
-  if (!(Number.isInteger(winLen) && winLen >= MIN_REVERSED_WINDOW_YEARS && winLen <= n)) {
-    throw new RangeError(
-      `Reversed-history windowLengthYears must be a whole number of years from ${MIN_REVERSED_WINDOW_YEARS} to ${n} (the length of the historical series); got ${winLen}.`,
-    )
-  }
+  const winLen = Math.max(MIN_REVERSED_WINDOW_YEARS, Math.min(n, config.windowLengthYears ?? 10))
```

Restores the silent clamp to [5, 96] in place of the refusal, the worksheet's first wrong reading: a requested window of 3 then runs as 5 and nothing is thrown.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/marketModels.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1 FORCE_COLOR=0`. The `Start at` and `Duration` lines are the only lines removed.

```

 RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (28 tests | 1 failed) 55ms
   ❯ market-model-reversed-history — Reversed-history window replay (4)
     × refuses a window that is not a whole number from 5 to 96, instead of clamping it 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 27 passed (28)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-reversed-history — Reversed-history window replay > refuses a window that is not a whole number from 5 to 96, instead of clamping it
AssertionError: expected function to throw an error, but it didn't
 ❯ src/montecarlo/marketModels.evidence.test.ts:634:99
    632|     it('refuses a window that is not a whole number from 5 to 96, inst…
    633|       for (const windowLengthYears of [3, 4, 4.999, 5.5, 97, 0, -5, Nu…
    634|         expect(() => createReversedHistoryModel({ type: 'reversed-hist…
       |                                                                                                   ^
    635|           new RangeError(
    636|             `Reversed-history windowLengthYears must be a whole number…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The mutated file was restored from a byte copy taken before the edit, and the restored bytes were compared with that copy and found identical, so no production code changed after the run. The evidence file then passes again on the unmutated code.
