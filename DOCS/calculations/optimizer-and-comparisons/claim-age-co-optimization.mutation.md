# Mutation receipt: claim-age-co-optimization

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-fourteen` at base `a4a278ef`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-26 against RetireGolden base `a3265275` (branch `claude/engine-law-fixes`, pull request #744), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1176b2e5` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `dc0c6c3f` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `df5da329` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/generators.ts`

```diff
diff --git a/packages/engine/src/decisions/generators.ts b/packages/engine/src/decisions/generators.ts
index c347e9d1..f3b145bb 100644
--- a/packages/engine/src/decisions/generators.ts
+++ b/packages/engine/src/decisions/generators.ts
@@ -359,7 +359,7 @@ export const socialSecurityClaimGenerator: CandidateGenerator = {
       if (person !== undefined && isClaimAlreadyMade(person, stream.claimAge, startYear)) continue
       const personLabel = person?.name ?? 'household member'
       for (const claim of canonicalClaimAges(person)) {
-        if (stream.claimAge.years === claim.years && stream.claimAge.months === claim.months) continue
+
         if (person !== undefined && isClaimAlreadyMade(person, claim, startYear)) continue
         const incomes = ctx.plan.incomes.map((income) =>
           income === stream ? { ...stream, claimAge: { years: claim.years, months: claim.months } } : income,
```

Stop skipping the stream's own current claim age — the worksheet's first wrong reading. The `70y0m` stream then generates all three canonical ages rather than the two that differ from it, and the published count becomes `1 + 3 = 4` instead of `3`. The generator assertion and the co-optimizer run both see it.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/optimizePlan.evidence.test.ts
```

## Captured failing output

Re-executed because merging main moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (23 tests | 4 failed) 701ms
   ❯ claim-age-co-optimization — Claim age co-optimization (9)
     × generates 2 candidates for an open claim at 70y0m, so 3 combinations are evaluated 13ms
     × offers no canonical age already passed: a 70-year-old claiming at 70 has none to try, and says so 7ms
     × searches the open claim of a couple whose other claim is already made, and holds that one 10ms
     × holds the current claim, so the joint estate IS the current-claim estate 213ms

 Test Files  1 failed (1)
      Tests  4 failed | 19 passed (23)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > claim-age-co-optimization — Claim age co-optimization > generates 2 candidates for an open claim at 70y0m, so 3 combinations are evaluated
AssertionError: expected [ …(3) ] to deeply equal [ …(2) ]

- Expected
+ Received

  [
    "Pat claims Social Security at 62",
    "Pat claims Social Security at 67 (FRA)",
+   "Pat claims Social Security at 70",
  ]

 ❯ src/projection/optimizePlan.evidence.test.ts:961:69
    959|       // Born 1966-01-01: full retirement age 67; 62 falls in 2028 and…
    960|       // 2033, both open. The stream's own 70y0m is skipped: 3 - 1 = 2.
    961|       expect(candidates.map((candidate) => candidate.label).sort()).to…
       |                                                                     ^
    962|         'Pat claims Social Security at 62',
    963|         'Pat claims Social Security at 67 (FRA)',

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > claim-age-co-optimization — Claim age co-optimization > offers no canonical age already passed: a 70-year-old claiming at 70 has none to try, and says so
AssertionError: expected 1 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 1

 ❯ src/projection/optimizePlan.evidence.test.ts:972:48
    970|       const plan = claimPlan(inputs.pastAgesFixture!)
    971|       // Born 1956-01-01: 62 fell in 2018 and 66y2m in 2022, both befo…
    972|       expect(generatedCandidates(plan).length).toBe(example.expected.p…
       |                                                ^
    973|       const joint = await optimizePlanCoOptimizingClaimAge(plan, feder…
    974|       expect(joint.claimAge.outcome).toBe('no-age-left')

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > claim-age-co-optimization — Claim age co-optimization > searches the open claim of a couple whose other claim is already made, and holds that one
AssertionError: expected [ …(3) ] to deeply equal [ …(2) ]

- Expected
+ Received

  [
    "Sam claims Social Security at 62",
    "Sam claims Social Security at 67 (FRA)",
+   "Sam claims Social Security at 70",
  ]

 ❯ src/projection/optimizePlan.evidence.test.ts:1001:84
    999|       })
    1000|       // Pat claimed at 62 in 2025, before the plan: no candidate move…
    1001|       expect(generatedCandidates(plan).map((candidate) => candidate.la…
       |                                                                                    ^
    1002|         'Sam claims Social Security at 62',
    1003|         'Sam claims Social Security at 67 (FRA)',

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > claim-age-co-optimization — Claim age co-optimization > holds the current claim, so the joint estate IS the current-claim estate
AssertionError: expected 4 to be 3 // Object.is equality

- Expected
+ Received

- 3
+ 4

 ❯ src/projection/optimizePlan.evidence.test.ts:1043:52
    1041|     it('holds the current claim, so the joint estate IS the current-cl…
    1042|       const joint = await optimizePlanCoOptimizingClaimAge(claimPlan(i…
    1043|       expect(joint.claimAge.combinationsEvaluated).toBe(example.expect…
       |                                                    ^
    1044|       // No traditional balance, so every conversion schedule is empty…
    1045|       // claim candidate clears the $1,000 switch margin.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/generators.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/generators.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
