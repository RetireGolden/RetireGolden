# Mutation receipt: exact-ledger-tournament-margin

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-fourteen` at base `a4a278ef`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-26 against RetireGolden base `fff2423b` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/optimizePlan.ts`

```diff
diff --git a/packages/engine/src/projection/optimizePlan.ts b/packages/engine/src/projection/optimizePlan.ts
index 1764ef96..ab5a02a0 100644
--- a/packages/engine/src/projection/optimizePlan.ts
+++ b/packages/engine/src/projection/optimizePlan.ts
@@ -1867,7 +1867,7 @@ function fallbackTournament(
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

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (optimizePlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/projection/optimizePlan.evidence.test.ts (17 tests | 1 failed) 294ms
   ❯ exact-ledger-tournament-margin — Full projection tournament margin (2)
     × publishes $0 and the executed $20,000 when the applied schedule holds 159ms

 Test Files  1 failed (1)
      Tests  1 failed | 16 passed (17)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.evidence.test.ts > exact-ledger-tournament-margin — Full projection tournament margin > publishes $0 and the executed $20,000 when the applied schedule holds
AssertionError: incumbent marginOverMilpDollars: actual 90702.09287729522, worksheet 0: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/optimizePlan.evidence.test.ts:762:9
    760|         withinTolerance(tournament.marginOverMilpDollars, expectedMarg…
    761|         `incumbent marginOverMilpDollars: actual ${tournament.marginOv…
    762|       ).toBe(true)
       |         ^
    763|       // The worksheet's first wrong reading: candidates on this plan …
    764|       // nonzero estate deltas, and publishing one of them as the marg…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/optimizePlan.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/optimizePlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
