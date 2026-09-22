# Mutation receipt: qcd-income-offset-qualified-slice

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

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

This caps the qualified slice at the pre-distribution balance instead of the aggregate includible amount, so the whole $60,000 gift qualifies where the worksheet's ceiling allows $40,000 (the fixture's pre-distribution balance is the 40,000 includible amount plus 20,000 of basis). It is a ceiling misread rather than one of the worksheet's three listed wrong readings (which concern the allocation order, the §219 offset and the gross RMD); it kills the qualified-slice, income-offset and inclusion assertions.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualLegacyQcdOwnerCharacterPlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts (5 tests | 3 failed) 6ms
   ❯ qcd-income-offset-qualified-slice — QCD income offset and qualified slice (5)
     × qualifies 40,000 of the gift, the aggregate includible amount rather than the RMD 4ms
     × publishes a 25,000 ordinary inclusion after the offset and the beyond-RMD delta 0ms
     × excludes 30,000 from income: the from-RMD portion less the 20,000 of non-qualified dollars charged to it first 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts > qcd-income-offset-qualified-slice — QCD income offset and qualified slice > qualifies 40,000 of the gift, the aggregate includible amount rather than the RMD
AssertionError: qualifiedBeforeOffset 60000 is not within {"abs":0.005} of the worksheet's 40000: expected false to be true // Object.is equality

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
AssertionError: resultingOrdinaryInclusion 5000 is not within {"abs":0.005} of the worksheet's 25000: expected false to be true // Object.is equality

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
 ❯ src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts:99:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/projection/internal/annualLegacyQcdOwnerCharacterPlan.evidence.test.ts > qcd-income-offset-qualified-slice — QCD income offset and qualified slice > excludes 30,000 from income: the from-RMD portion less the 20,000 of non-qualified dollars charged to it first
AssertionError: qcdIncomeOffset 50000 is not within {"abs":0.005} of the worksheet's 30000: expected false to be true // Object.is equality

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

The original bytes of `packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualLegacyQcdOwnerCharacterPlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
