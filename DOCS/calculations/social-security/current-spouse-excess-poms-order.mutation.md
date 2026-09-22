# Mutation receipt: current-spouse-excess-poms-order

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/currentSpouseBenefit.ts`

```diff
@@ -131,6 +131,6 @@ export function ordinarySimultaneousEarlyCurrentSpouseComponents(
   if (!(unreducedExcess > 0)) return null
   return {
     ownMonthly: input.ownActualMonthly,
-    auxiliaryMonthly: unreducedExcess * input.spousalFactor,
+    auxiliaryMonthly: Math.max(0, 0.5 * input.workerPiaMonthly * input.spousalFactor - input.ownActualMonthly),
   }
 }
```

This reduces the full half-of-worker-PIA spousal amount first and then subtracts the already reduced own benefit, publishing an auxiliary of 1,150/3 — the worksheet's first wrong reading, which is the paired fallback worksheet's figure.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/currentSpouseBenefit.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (currentSpouseBenefit.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/socialSecurity/currentSpouseBenefit.evidence.test.ts (3 tests | 2 failed) 6ms
   ❯ current-spouse-excess-poms-order — Current-spouse excess in the POMS order (3)
     × reduces only the 500 excess, publishing 1,250/3 of auxiliary and 3,850/3 combined 4ms
     × does not reduce half the worker PIA before subtracting 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/currentSpouseBenefit.evidence.test.ts > current-spouse-excess-poms-order — Current-spouse excess in the POMS order > reduces only the 500 excess, publishing 1,250/3 of auxiliary and 3,850/3 combined
AssertionError: auxiliaryMonthly 383.33333333333326 is not within {"abs":1e-9} of the worksheet's 416.6666666666667: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/currentSpouseBenefit.evidence.test.ts:16:5
     14|     withinTolerance(actual, expected, tolerance),
     15|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     16|   ).toBe(true)
       |     ^
     17| }
     18|
 ❯ src/socialSecurity/currentSpouseBenefit.evidence.test.ts:85:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/currentSpouseBenefit.evidence.test.ts > current-spouse-excess-poms-order — Current-spouse excess in the POMS order > does not reduce half the worker PIA before subtracting
AssertionError: expected 383.33333333333326 to be greater than 383.33333333333326
 ❯ src/socialSecurity/currentSpouseBenefit.evidence.test.ts:102:40
    100|         0.5 * inputs.workerPiaMonthly! * spousalFactor - ownActualMont…
    101|       )
    102|       expect(result!.auxiliaryMonthly).toBeGreaterThan(reduceThenSubtr…
       |                                        ^
    103|     })
    104|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/currentSpouseBenefit.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/currentSpouseBenefit.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
