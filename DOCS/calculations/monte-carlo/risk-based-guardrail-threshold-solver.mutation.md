# Mutation receipt: risk-based-guardrail-threshold-solver

Executed 2026-09-26 against RetireGolden base `8ff951e4` with the solver change of this commit applied (branch claude/monte-carlo-models), and re-executed 2026-09-26 against RetireGolden base `a78a1c30` (branch `claude/monte-carlo-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/riskBasedGuardrails.ts`

```diff
--- a/packages/engine/src/montecarlo/riskBasedGuardrails.ts
+++ b/packages/engine/src/montecarlo/riskBasedGuardrails.ts
@@ mutation @@
-      threshold: { balanceFrac: hi, balanceDollars: hi * startingInvestable, successAtThreshold: successAtFrac(hi) },
+      threshold: { balanceFrac: lo, balanceDollars: lo * startingInvestable, successAtThreshold: successAtFrac(lo) },
```

Returns `lo` instead of `hi` from each band-edge bisection, the worksheet's first wrong reading: the edges become 1.3997851562499997 (k = 355) and 1.8972851562499997 (k = 483), and the adjustments and the probe sequence move with them.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/riskBasedGuardrails.evidence.test.ts
```

## Captured failing output

Re-executed against the current head so every receipt on the branch records the same commit; the quoted test lines had not moved, and only the timings differ from the earlier run. The baseline is green (riskBasedGuardrails.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine3/packages/engine

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts (5 tests | 3 failed) 18ms
   ❯ risk-based-guardrail-threshold-solver — Risk-based guardrail thresholds and suggested adjustments by bisection (4)
     × edges at k = 356 and 484 on 0.02 + k · 3.98/1024: 1.403671875 ($701,835.9375) and 1.901171875 ($950,585.9375) 4ms
     × cut 0.849609375 ($501.3020833333333 a month) and raise 1.1484375 ($494.7916666666667 a month) 1ms
     × follows the worksheet's bisection paths and calls the probe 40 times, reporting progress up to (40, 41) 2ms

 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)

  Transform  transforming modules took 2.44s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/riskBasedGuardrails.evidence.test.ts > risk-based-guardrail-threshold-solver — Risk-based guardrail thresholds and suggested adjustments by bisection > edges at k = 356 and 484 on 0.02 + k · 3.98/1024: 1.403671875 ($701,835.9375) and 1.901171875 ($950,585.9375)
AssertionError: expected 355 to be 356 // Object.is equality

- Expected
+ Received

- 356
+ 355

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts:155:71
    153|       expect(solution.lowerOutcome).toBe('solved')
    154|       expect(solution.upperOutcome).toBe('solved')
    155|       expect(Math.round((solution.lower!.balanceFrac - 0.02) / STEP)).…
       |                                                                       ^
    156|       expect(Math.round((solution.upper!.balanceFrac - 0.02) / STEP)).…
    157|       expectWithin(solution.lower!.balanceFrac, expected.lowerBalanceF…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/montecarlo/riskBasedGuardrails.evidence.test.ts > risk-based-guardrail-threshold-solver — Risk-based guardrail thresholds and suggested adjustments by bisection > cut 0.849609375 ($501.3020833333333 a month) and raise 1.1484375 ($494.7916666666667 a month)
AssertionError: cut multiplier 0.8468749999999999 is not within {"abs":1e-12} of 0.849609375: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/montecarlo/riskBasedGuardrails.evidence.test.ts:145:136
    143|
    144|     function expectWithin(actual: number, target: number, label: strin…
    145|       expect(withinTolerance(actual, target, tolerance), `${label} ${a…
       |                                                                                                                                        ^
    146|     }
    147|
 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts:169:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/montecarlo/riskBasedGuardrails.evidence.test.ts > risk-based-guardrail-threshold-solver — Risk-based guardrail thresholds and suggested adjustments by bisection > follows the worksheet's bisection paths and calls the probe 40 times, reporting progress up to (40, 41)
AssertionError: expected [ +0, 128, 192, 224, 208, 200, …(4) ] to deeply equal [ +0, 128, 192, 224, 208, 200, …(4) ]

- Expected
+ Received

@@ -6,7 +6,7 @@
    208,
    200,
    204,
    202,
    201,
-   201,
+   200,
  ]

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts:200:63
    198|       // The cut: best case at m = 0.3, eight mids on 0.3 + j · 0.7/25…
    199|       const cutIndex = (m: number) => Math.round((m - 0.3) / (0.7 / 25…
    200|       expect(calls.slice(20, 30).map(([, m]) => cutIndex(m))).toEqual(…
       |                                                               ^
    201|       // The raise: best case at m = 2, eight mids on 1 + j/256, then …
    202|       expect(calls.slice(30, 40).map(([, m]) => Math.round((m - 1) * 2…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/riskBasedGuardrails.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/riskBasedGuardrails.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
