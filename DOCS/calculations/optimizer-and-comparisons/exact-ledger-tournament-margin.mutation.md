# Mutation receipt: exact-ledger-tournament-margin

Executed 2026-09-18 against RetireGolden base `a4a278ef` (branch `claude/b1-p4-cards-slice-fourteen`) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/optimizePlan.ts`

```diff
diff --git a/packages/engine/src/projection/optimizePlan.ts b/packages/engine/src/projection/optimizePlan.ts
index 09307876..7acb6010 100644
--- a/packages/engine/src/projection/optimizePlan.ts
+++ b/packages/engine/src/projection/optimizePlan.ts
@@ -1859,7 +1859,7 @@ function fallbackTournament(
       winnerLabel: incumbentLabel(plan),
       winnerConversions: incumbent,
       winnerValidation: null,
-      marginOverMilpDollars: 0,
+      marginOverMilpDollars: candidates.reduce((best, row) => Math.max(best, row.afterTaxEstateDelta), 0),
       searchRefined: search.searchRefined,
       searchSimulations: search.searchSimulations,
       acaActionabilityVeto,
```

Publish a candidate-versus-incumbent estate difference on the incumbent fallback — the worksheet's first wrong reading. No MILP comparison was made on that path, so the required value is `$0`; the mutation reports the best candidate's exact estate delta instead, and the fixture sees `$90,702.09`.

A note on the other two wrong readings. The second — treating a no-traditional plan as an incumbent — is guarded by `incumbentExecutedConversions`, whose `mode === 'none'` and `rothConversion > 1` tests the none fixture already pins through `winnerSource` and an empty `winnerConversions`; it is a different field from the margin this receipt mutates. The third, the inclusive switch threshold, lives on the candidate-over-MILP branch this record names as a solver-run limit: with no MILP result supplied to either fixture, `milpRecommended` is null and the threshold is never reached, so no mutation of it is observable here.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/optimizePlan.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and the transform-cache advisory were removed. Exit code: 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s14/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (17 tests | 1 failed) 278ms
   ❯ exact-ledger-tournament-margin — Exact ledger tournament margin (2)
     × publishes $0 and the executed $20,000 when the applied schedule holds 147ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-tournament-margin — Exact ledger tournament margin > publishes $0 and the executed $20,000 when the applied schedule holds
AssertionError: incumbent marginOverMilpDollars: actual 90702.09287729522, worksheet 0: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/optimizePlan.evidence.test.ts:761:9
    759|         withinTolerance(tournament.marginOverMilpDollars, expectedMarg…
    760|         `incumbent marginOverMilpDollars: actual ${tournament.marginOv…
    761|       ).toBe(true)
       |         ^
    762|       // The worksheet's first wrong reading: candidates on this plan …
    763|       // nonzero estate deltas, and publishing one of them as the marg…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)
```

## Revert

`git checkout -- packages/engine/src/projection/optimizePlan.ts` restored the file, and `git diff --quiet -- packages/engine/src/projection/optimizePlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the named file passed again (17 passed, exit 0).
