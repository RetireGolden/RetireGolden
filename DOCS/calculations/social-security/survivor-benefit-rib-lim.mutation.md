# Mutation receipt: survivor-benefit-rib-lim

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/survivorBenefit.ts`

```diff
@@ -69,7 +69,7 @@ export function survivorReductionFactor(ageMonths: number, survivorFraMonths: nu
  */
 export function survivorBenefitMonthly(input: SurvivorBenefitInput): number {
   if (input.deceasedPiaMonthly <= 0) return 0
-  const base = Math.max(input.deceasedActualMonthly, WIDOW_LIMIT_PIA_FRACTION * input.deceasedPiaMonthly)
+  const base = input.deceasedActualMonthly
   const ageMonths = input.survivorClaimAge.years * 12 + input.survivorClaimAge.months
   return base * survivorReductionFactor(ageMonths, input.survivorFraMonths)
 }
```

This drops the RIB-LIM widow's-limit floor and reduces the deceased's actual benefit directly, publishing $1,001.00 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/survivorBenefit.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (survivorBenefit.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/socialSecurity/survivorBenefit.evidence.test.ts (3 tests | 2 failed) 6ms
   ❯ survivor-benefit-rib-lim — Survivor benefit under RIB-LIM (3)
     × floors the base at 82.5% of PIA and reduces it 28.5% at age 60 4ms
     × takes the widow limit over the deceased's smaller actual benefit 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/survivorBenefit.evidence.test.ts > survivor-benefit-rib-lim — Survivor benefit under RIB-LIM > floors the base at 82.5% of PIA and reduces it 28.5% at age 60
AssertionError: monthlyBenefit 1001.0000000000001 is not within {"abs":0.005} of the worksheet's 1179.75: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/survivorBenefit.evidence.test.ts:22:5
     20|     withinTolerance(actual, expected, tolerance),
     21|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     22|   ).toBe(true)
       |     ^
     23| }
     24|
 ❯ src/socialSecurity/survivorBenefit.evidence.test.ts:81:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/survivorBenefit.evidence.test.ts > survivor-benefit-rib-lim — Survivor benefit under RIB-LIM > takes the widow limit over the deceased's smaller actual benefit
AssertionError: monthlyBenefit 1001.0000000000001 is not within {"abs":0.005} of the worksheet's 1179.75: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/survivorBenefit.evidence.test.ts:22:5
     20|     withinTolerance(actual, expected, tolerance),
     21|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     22|   ).toBe(true)
       |     ^
     23| }
     24|
 ❯ src/socialSecurity/survivorBenefit.evidence.test.ts:96:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/survivorBenefit.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/survivorBenefit.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
