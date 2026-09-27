# Mutation receipt: risk-based-guardrail-threshold-solver

Executed 2026-09-26 against RetireGolden base `8ff951e4` with the solver change of this commit applied (branch claude/monte-carlo-models), and re-executed 2026-09-26 against RetireGolden base `a78a1c30` (branch `claude/monte-carlo-models`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/riskBasedGuardrails.ts`

```diff
diff --git a/packages/engine/src/montecarlo/riskBasedGuardrails.ts b/packages/engine/src/montecarlo/riskBasedGuardrails.ts
index a0e0bc3b..d2c56a98 100644
--- a/packages/engine/src/montecarlo/riskBasedGuardrails.ts
+++ b/packages/engine/src/montecarlo/riskBasedGuardrails.ts
@@ -275,7 +275,7 @@ export function solveRiskBasedGuardrails(plan: Plan, opts: RiskBasedGuardrailSol
       else lo = mid
     }
     return {
-      threshold: { balanceFrac: hi, balancePct: balanceThresholdPct(hi), successAtThreshold: successAtFrac(hi) },
+      threshold: { balanceFrac: lo, balancePct: balanceThresholdPct(lo), successAtThreshold: successAtFrac(lo) },
       outcome: 'solved',
     }
   }
```

Returns `lo` instead of `hi` from each band-edge bisection, the worksheet's first wrong reading: the edges become 1.3997851562499997 (k = 355) and 1.8972851562499997 (k = 483), and the adjustments and the probe sequence move with them. Rewritten for B2-P1 slice 2, which replaced `balanceDollars` with the persisted percent `balancePct` on the same line.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/riskBasedGuardrails.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after merging RetireGolden #751 into B2-P1 slice 2: the drift check #751 adds flagged this receipt against the slice's code (a hunk header naming a line the code has moved from, a context line the slice changed, a header naming no line, or a stated test count the slice's evidence file no longer has), so the diff header, capture, blob hash and revert note are refreshed against this head. The baseline is green (riskBasedGuardrails.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts (5 tests | 3 failed) 17ms
   ❯ risk-based-guardrail-threshold-solver — Risk-based guardrail thresholds and suggested adjustments by bisection (4)
     × edges at k = 356 and 484 on 0.02 + k · 3.98/1024: 1.403671875 and 1.901171875, persisted as 140.37 and 190.12 percent 4ms
     × cut 0.849609375 ($501.3020833333333 a month) and raise 1.1484375 ($494.7916666666667 a month) 1ms
     × follows the worksheet's bisection paths and calls the probe 40 times, reporting progress up to (40, 41) 2ms

 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/riskBasedGuardrails.evidence.test.ts > risk-based-guardrail-threshold-solver — Risk-based guardrail thresholds and suggested adjustments by bisection > edges at k = 356 and 484 on 0.02 + k · 3.98/1024: 1.403671875 and 1.901171875, persisted as 140.37 and 190.12 percent
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
 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts:170:7

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

 ❯ src/montecarlo/riskBasedGuardrails.evidence.test.ts:201:63
    199|       // The cut: best case at m = 0.3, eight mids on 0.3 + j · 0.7/25…
    200|       const cutIndex = (m: number) => Math.round((m - 0.3) / (0.7 / 25…
    201|       expect(calls.slice(20, 30).map(([, m]) => cutIndex(m))).toEqual(…
       |                                                               ^
    202|       // The raise: best case at m = 2, eight mids on 1 + j/256, then …
    203|       expect(calls.slice(30, 40).map(([, m]) => Math.round((m - 1) * 2…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/riskBasedGuardrails.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/riskBasedGuardrails.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
