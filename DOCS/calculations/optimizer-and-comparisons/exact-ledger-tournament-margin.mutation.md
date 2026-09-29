# Mutation receipt: exact-ledger-tournament-margin

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-fourteen` at base `a4a278ef`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1176b2e5` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `dc0c6c3f` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `61ceb34a` (branch `claude/mc-provenance-and-seed`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `04218ee3` (branch `claude/2027-published-figures`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `5f0bdbda` (branch `claude/2027-rollover`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `d8edbfd2` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/optimizePlan.ts`

```diff
diff --git a/packages/engine/src/projection/optimizePlan.ts b/packages/engine/src/projection/optimizePlan.ts
index 4dc447d3..a533534b 100644
--- a/packages/engine/src/projection/optimizePlan.ts
+++ b/packages/engine/src/projection/optimizePlan.ts
@@ -1925,7 +1925,7 @@ function fallbackTournament(
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

The second verification's fixes on this branch (V1 to V4) moved the lines these receipts quote; the mutations are unchanged. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (23 tests | 1 failed) 899ms
   ❯ exact-ledger-tournament-margin — Full projection tournament margin (2)
     × publishes $0 and the executed $20,000 when the applied schedule holds 164ms

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-tournament-margin — Full projection tournament margin > publishes $0 and the executed $20,000 when the applied schedule holds
AssertionError: incumbent marginOverMilpDollars: actual 90702.09287729522, worksheet 0: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/optimizePlan.evidence.test.ts:763:9
    761|         withinTolerance(tournament.marginOverMilpDollars, expectedMarg…
    762|         `incumbent marginOverMilpDollars: actual ${tournament.marginOv…
    763|       ).toBe(true)
       |         ^
    764|       // The worksheet's first wrong reading: candidates on this plan …
    765|       // nonzero estate deltas, and publishing one of them as the marg…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/optimizePlan.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/optimizePlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
