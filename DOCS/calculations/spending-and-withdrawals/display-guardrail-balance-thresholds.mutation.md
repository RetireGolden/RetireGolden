# Mutation receipt: guardrail-threshold-dollars

Executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `54306786` (branch `claude/mc-provenance-and-seed`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/riskBasedGuardrails.ts`

```diff
diff --git a/packages/engine/src/montecarlo/riskBasedGuardrails.ts b/packages/engine/src/montecarlo/riskBasedGuardrails.ts
index 5672cb3e..ca92a270 100644
--- a/packages/engine/src/montecarlo/riskBasedGuardrails.ts
+++ b/packages/engine/src/montecarlo/riskBasedGuardrails.ts
@@ -380,5 +380,5 @@
   const lower = lowerPct === null ? null : (lowerPct / 100) * base
   const upper = upperPct === null ? null : (upperPct / 100) * base
-  return { status: 'anchored', base, lower, upper, acts: !(lower !== null && upper !== null && lower >= upper) }
+  return { status: 'anchored', base, lower, upper, acts: !(lower !== null && upper !== null && lower > upper) }
 }
 
```

Treats equal cut and raise thresholds as a policy that acts; the ledger holds whenever the cut threshold is not below the raise threshold, so case F (60 and 60 percent) would be shown as active while it never cuts or raises.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/riskBasedGuardrails.thresholdDollars.evidence.test.ts
```

## Captured failing output

Re-executed for the drift check because implementing D-EXAMPLE-SOURCE-SWITCH, D-ACA-CONTRACT-PATHS and D-MC-DEFAULT-SEED moved lines of its production file or its evidence test; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (riskBasedGuardrails.thresholdDollars.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/riskBasedGuardrails.thresholdDollars.evidence.test.ts (7 tests | 1 failed) 55ms
   ❯ guardrail-threshold-dollars — Risk-based guardrail thresholds in dollars (7)
     × cases E, F and G: unsolved, an inverted pair that never acts, and a policy that is not risk-based 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/riskBasedGuardrails.thresholdDollars.evidence.test.ts > guardrail-threshold-dollars — Risk-based guardrail thresholds in dollars > cases E, F and G: unsolved, an inverted pair that never acts, and a policy that is not risk-based
AssertionError: expected { status: 'anchored', …(4) } to deeply equal { status: 'anchored', …(4) }

- Expected
+ Received

  {
-   "acts": false,
+   "acts": true,
    "base": 500000,
    "lower": 300000,
    "status": "anchored",
    "upper": 300000,
  }

 ❯ src/montecarlo/riskBasedGuardrails.thresholdDollars.evidence.test.ts:145:101
    143|       expect(guardrailThresholdDollars(planWith(inputs.caseE!.balances…
    144|       const f = inputs.caseF!
    145|       expect(guardrailThresholdDollars(planWith(f.balances, { lower: f…
       |                                                                                                     ^
    146|         status: 'anchored',
    147|         ...expected.caseF,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/riskBasedGuardrails.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/riskBasedGuardrails.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
