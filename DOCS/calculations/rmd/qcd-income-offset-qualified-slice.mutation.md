# Mutation receipt: qcd-income-offset-qualified-slice

Executed 2026-09-18 and re-executed the same day against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts`

```diff
@@ -193,7 +193,7 @@ export function annualLegacyQcdOwnerCharacterPlan(
       input.qcdFromRmdByOwner.get(ownerId) ?? 0,
     )
     const aggregateIncludible = Math.max(0, preDistribution - basis)
-    const qualified = Math.min(gift, aggregateIncludible)
+    const qualified = Math.min(gift, preDistribution)
     const section219 = input.qcdSection219ByDonor.get(ownerId) ?? 0
     const consumedCents = input.qcdOffsetConsumedByDonor.get(ownerId) ?? 0
     const consumedDollars = consumedCents / 100
```

This caps the qualified slice at the pre-distribution balance instead of the aggregate includible amount, so $50,000 qualifies where the worksheet's ceiling allows $40,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-18 after the worksheet was re-derived on the engine's allocation order (the non-qualified remainder charged to the from-RMD portion first) and the fixture followed it. The baseline is green (annualLegacyQcdOwnerCharacterPlan.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s8/packages/engine

 ❯ src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts (5 tests | 3 failed) 6ms
   ❯ qcd-income-offset-qualified-slice — QCD income offset and qualified slice (5)
     × qualifies 40,000 of the gift, the aggregate includible amount rather than the RMD 4ms
     × publishes a 25,000 ordinary inclusion after the offset and the beyond-RMD delta 0ms
     × excludes 30,000 from income: the from-RMD portion less the 20,000 of non-qualified dollars charged to it first 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts > qcd-income-offset-qualified-slice — QCD income offset and qualified slice > qualifies 40,000 of the gift, the aggregate includible amount rather than the RMD
AssertionError: qualifiedBeforeOffset 50000 is not within {"abs":0.005} of the worksheet's 40000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts:15:5
     13|     withinTolerance(actual, expected, tolerance),
     14|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     15|   ).toBe(true)
       |     ^
     16| }
     17|
 ❯ src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts:75:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts > qcd-income-offset-qualified-slice — QCD income offset and qualified slice > publishes a 25,000 ordinary inclusion after the offset and the beyond-RMD delta
AssertionError: resultingOrdinaryInclusion 15000 is not within {"abs":0.005} of the worksheet's 25000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts:15:5
     13|     withinTolerance(actual, expected, tolerance),
     14|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     15|   ).toBe(true)
       |     ^
     16| }
     17|
 ❯ src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts:98:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts > qcd-income-offset-qualified-slice — QCD income offset and qualified slice > excludes 30,000 from income: the from-RMD portion less the 20,000 of non-qualified dollars charged to it first
AssertionError: qcdIncomeOffset 40000 is not within {"abs":0.005} of the worksheet's 30000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts:15:5
     13|     withinTolerance(actual, expected, tolerance),
     14|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     15|   ).toBe(true)
       |     ^
     16| }
     17|
 ❯ src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts:114:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts` exited 0, confirming no change to production code after the run.
