# Mutation receipt: early-claim-factor

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/benefitFactor.ts`

```diff
@@ -15,7 +15,7 @@ export function earlyRetirementFactor(monthsBeforeFra: number): number {
   const m = monthsBeforeFra
   const first = Math.min(36, m)
   const second = Math.max(0, m - 36)
-  const reductionPct = first * (5 / 9) + second * (5 / 12)
+  const reductionPct = (first + second) * (5 / 9)
   return 1 - reductionPct / 100
 }
 
```

This charges 5/9 of 1% for all 60 early months instead of switching to 5/12 beyond 36, publishing 2/3 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/benefitFactor.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (benefitFactor.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/socialSecurity/benefitFactor.evidence.test.ts (6 tests | 2 failed) 5ms
   ❯ early-claim-factor — Early claim reduction factor (3)
     × reduces 60 early months to a factor of 0.70 across both bands 3ms
     × charges the steeper 5/9 rate only through the first 36 months 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/benefitFactor.evidence.test.ts > early-claim-factor — Early claim reduction factor > reduces 60 early months to a factor of 0.70 across both bands
AssertionError: factor 0.6666666666666666 is not within {"abs":1e-12} of the worksheet's 0.7: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/benefitFactor.evidence.test.ts:15:5
     13|     withinTolerance(actual, expected, tolerance),
     14|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     15|   ).toBe(true)
       |     ^
     16| }
     17|
 ❯ src/socialSecurity/benefitFactor.evidence.test.ts:68:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/benefitFactor.evidence.test.ts > early-claim-factor — Early claim reduction factor > charges the steeper 5/9 rate only through the first 36 months
AssertionError: expected 0.6666666666666666 to be greater than 0.6666666666666666
 ❯ src/socialSecurity/benefitFactor.evidence.test.ts:75:62
     73|       const firstBandOnly = earlyRetirementFactor(inputs.firstBandMont…
     74|       expectWithin(firstBandOnly, 0.8, example.tolerance, 'factor at 3…
     75|       expect(earlyRetirementFactor(inputs.monthsBeforeNra!)).toBeGreat…
       |                                                              ^
     76|     })
     77|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/benefitFactor.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/benefitFactor.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
