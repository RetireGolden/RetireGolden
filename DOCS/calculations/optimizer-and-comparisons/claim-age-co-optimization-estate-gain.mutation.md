# Mutation receipt: claim-change-estate-gain

Executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d33ac09` (branch `claude/b2p1-slice3-comparisons`, pull request #754), and re-executed 2026-09-28 against RetireGolden base `dc0c6c3f` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `61ceb34a` (branch `claude/mc-provenance-and-seed`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `04218ee3` (branch `claude/2027-published-figures`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `5f0bdbda` (branch `claude/2027-rollover`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `d8edbfd2` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/optimizePlan.ts`

```diff
diff --git a/packages/engine/src/projection/optimizePlan.ts b/packages/engine/src/projection/optimizePlan.ts
index 4dc447d3..b0b8b275 100644
--- a/packages/engine/src/projection/optimizePlan.ts
+++ b/packages/engine/src/projection/optimizePlan.ts
@@ -3101,7 +3101,7 @@ export async function optimizePlanCoOptimizingClaimAge(
       winningClaimPatch: winningPatch,
       jointExactEstate: bestEstate,
       currentClaimExactEstate: baseEstate,
-      claimChangeEstateGain: compareScalars(baseEstate, bestEstate).delta,
+      claimChangeEstateGain: compareScalars(bestEstate, baseEstate).delta,
       estateYear,
     },
   }
```

Current minus joint, the worksheet's first wrong reading: on the plan whose claim change wins, the published gain is the negative of the joint estate minus the current-claim estate, a loss on a card that says "more". Case S still reads 0, since the two estates are then one number.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/optimizePlan.claimGain.evidence.test.ts
```

## Captured failing output

The second verification's fixes on this branch (V1 to V4) moved the lines these receipts quote; the mutations are unchanged. The baseline is green (optimizePlan.claimGain.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/optimizePlan.claimGain.evidence.test.ts (3 tests | 1 failed) 321ms
   ❯ claim-change-estate-gain — Claim-age co-optimization estate gain (3)
     × a plan whose claim change wins publishes the joint minus current estate, more than the $1,000 margin, in its last year's dollars 239ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/optimizePlan.claimGain.evidence.test.ts > claim-change-estate-gain — Claim-age co-optimization estate gain > a plan whose claim change wins publishes the joint minus current estate, more than the $1,000 margin, in its last year's dollars
AssertionError: expected -263327.9999999996 to be 263327.9999999996 // Object.is equality

- Expected
+ Received

- 263327.9999999996
+ -263327.9999999996

 ❯ src/projection/optimizePlan.claimGain.evidence.test.ts:102:43
    100|       expect(claim.winningClaimLabel).not.toBeNull()
    101|       expect(claim.winningClaimPatch).not.toBeNull()
    102|       expect(claim.claimChangeEstateGain).toBe(claim.jointExactEstate …
       |                                           ^
    103|       expect(claim.claimChangeEstateGain).toBeGreaterThan(inputs.switc…
    104|       expect(claim.estateYear).toBe(expected.winningEstateYear)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/optimizePlan.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/optimizePlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
