# Mutation receipt: early-claim-factor

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

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

```
FAIL  src/socialSecurity/benefitFactor.evidence.test.ts > early-claim-factor — Early claim reduction factor > reduces 60 early months to a factor of 0.70 across both bands
AssertionError: factor 0.6666666666666666 is not within {"abs":1e-12} of the worksheet's 0.7: expected false to be true // Object.is equality

FAIL  src/socialSecurity/benefitFactor.evidence.test.ts > early-claim-factor — Early claim reduction factor > charges the steeper 5/9 rate only through the first 36 months
AssertionError: expected 0.6666666666666666 to be greater than 0.6666666666666666
```

## Revert

`git checkout -- packages/engine/src/socialSecurity/benefitFactor.ts`, then `git diff --quiet -- packages/engine/src/socialSecurity/benefitFactor.ts` exited 0, confirming no change to production code after the run.
