# Mutation receipt: claim-age-co-optimization

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-fourteen` at base `a4a278ef`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/generators.ts`

```diff
diff --git a/packages/engine/src/decisions/generators.ts b/packages/engine/src/decisions/generators.ts
index b57d35e8..a4d23fdf 100644
--- a/packages/engine/src/decisions/generators.ts
+++ b/packages/engine/src/decisions/generators.ts
@@ -297,7 +297,6 @@ export const socialSecurityClaimGenerator: CandidateGenerator = {
       const person = ctx.plan.household.people.find((p) => p.id === stream.personId)
       const personLabel = person?.name ?? 'household member'
       for (const claim of SS_CLAIM_AGES) {
-        if (stream.claimAge.years === claim.years && stream.claimAge.months === claim.months) continue
         const incomes = ctx.plan.incomes.map((income) =>
           income === stream ? { ...stream, claimAge: { years: claim.years, months: claim.months } } : income,
         )
```

Stop skipping the stream's own current claim age — the worksheet's first wrong reading. The `70y0m` stream then generates all three canonical ages rather than the two that differ from it, and the published count becomes `1 + 3 = 4` instead of `3`. The generator assertion and the co-optimizer run both see it.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/optimizePlan.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (17 tests | 2 failed) 299ms
   ❯ claim-age-co-optimization — Claim age co-optimization (3)
     × generates 2 candidates for a stream already claiming at 70y0m, so 3 combinations are evaluated 5ms
     × holds the current claim, so the joint estate IS the current-claim estate 63ms

 Test Files  1 failed (1)
      Tests  2 failed | 15 passed (17)

  Transform  transforming modules took 2.53s · 42% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > claim-age-co-optimization — Claim age co-optimization > generates 2 candidates for a stream already claiming at 70y0m, so 3 combinations are evaluated
AssertionError: expected 3 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 3

 ❯ src/projection/optimizePlan.evidence.test.ts:949:33
    947|       // The canonical grid is {62y0m, 67y0m (FRA), 70y0m}; the stream…
    948|       // current 70y0m age is skipped, so 3 - 1 = 2 candidates are gen…
    949|       expect(candidates.length).toBe(example.expected.oneStreamGenerat…
       |                                 ^
    950|       expect(candidates.map((candidate) => candidate.label).sort()).to…
    951|         'Pat claims Social Security at 62',

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > claim-age-co-optimization — Claim age co-optimization > holds the current claim, so the joint estate IS the current-claim estate
AssertionError: expected 4 to be 3 // Object.is equality

- Expected
+ Received

- 3
+ 4

 ❯ src/projection/optimizePlan.evidence.test.ts:973:52
    971|       const joint = await optimizePlanCoOptimizingClaimAge(plan, feder…
    972|
    973|       expect(joint.claimAge.combinationsEvaluated).toBe(example.expect…
       |                                                    ^
    974|       // No traditional balance, so every conversion schedule is empty…
    975|       // claim candidate clears the $1,000 switch margin.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/generators.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/generators.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
