# Mutation receipt: market-model-reversed-history

Executed 2026-09-26 against RetireGolden base `8ff951e4` (branch claude/monte-carlo-models), and re-executed 2026-09-26 against RetireGolden base `a78a1c30` (branch `claude/monte-carlo-models`; no pull request is open yet) in `packages/engine`.

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

Re-executed after the review fixes of 2026-09-26 added tests to the evidence file, so the quoted test counts and line numbers match the committed file. The baseline is green (marketModels.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/marketModels.evidence.test.ts (30 tests | 1 failed) 55ms
   ❯ market-model-reversed-history — Reversed-history window replay (4)
     × refuses a window that is not a whole number from 5 to 96, instead of clamping it 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 29 passed (30)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/marketModels.evidence.test.ts > market-model-reversed-history — Reversed-history window replay > refuses a window that is not a whole number from 5 to 96, instead of clamping it
AssertionError: expected function to throw an error, but it didn't
 ❯ src/montecarlo/marketModels.evidence.test.ts:651:99
    649|     it('refuses a window that is not a whole number from 5 to 96, inst…
    650|       for (const windowLengthYears of [3, 4, 4.999, 5.5, 97, 0, -5, Nu…
    651|         expect(() => createReversedHistoryModel({ type: 'reversed-hist…
       |                                                                                                   ^
    652|           new RangeError(
    653|             `Reversed-history windowLengthYears must be a whole number…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/marketModels.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/marketModels.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
