# Mutation receipt: social-security-cola-factor

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/simulate.ts`

```diff
@@ -1653,7 +1653,7 @@ export function simulatePlan(plan: Plan, opts: SimulateOptions): ProjectionResul
     const ssColaFactor =
       plan.assumptions.ssCola.mode === 'matchInflation'
         ? inflFactorFrom(startYear, year)
-        : Math.pow(1 + plan.assumptions.ssCola.annualPct / 100, year - startYear)
+        : Math.pow(1 + plan.assumptions.ssCola.annualPct / 100, year - startYear + 1)
     const ssHaircutFactor =
       plan.assumptions.ssHaircut && year >= plan.assumptions.ssHaircut.fromYear
         ? 1 - plan.assumptions.ssHaircut.cutPct / 100
```

This applies the COLA once in the first projection year, so the start-year benefit is already escalated to $2,056 a month — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSocialSecurity.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualSocialSecurity.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts (6 tests | 2 failed) 32ms
   ❯ social-security-cola-factor — Social Security COLA factor (2)
     × compounds 2.8% from the projection start, leaving the first year unescalated 26ms
     × does not escalate the first projection year 3ms

 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-cola-factor — Social Security COLA factor > compounds 2.8% from the projection start, leaving the first year unescalated
AssertionError: monthly amount in 2026 2056 is not within {"abs":0.005} of the worksheet's 2000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.evidence.test.ts:25:5
     23|     withinTolerance(actual, expected, tolerance),
     24|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     25|   ).toBe(true)
       |     ^
     26| }
     27|
 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:263:9
 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:256:13

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > social-security-cola-factor — Social Security COLA factor > does not escalate the first projection year
AssertionError: start-year benefit 24672 is not within {"abs":0.005} of the worksheet's 24000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.evidence.test.ts:25:5
     23|     withinTolerance(actual, expected, tolerance),
     24|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     25|   ).toBe(true)
       |     ^
     26| }
     27|
 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:277:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/simulate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/simulate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
