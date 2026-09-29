# Mutation receipt: claim-change-estate-gain

Executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2d33ac09` (branch `claude/b2p1-slice3-comparisons`, pull request #754), and re-executed 2026-09-28 against RetireGolden base `dc0c6c3f` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `61ceb34a` (branch `claude/mc-provenance-and-seed`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/optimizePlan.ts`

```diff
diff --git a/packages/engine/src/projection/optimizePlan.ts b/packages/engine/src/projection/optimizePlan.ts
index 65e5e29c..2aba8001 100644
--- a/packages/engine/src/projection/optimizePlan.ts
+++ b/packages/engine/src/projection/optimizePlan.ts
@@ -3059,7 +3059,7 @@ export async function optimizePlanCoOptimizingClaimAge(
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

Re-executed after merging origin/main 4d2d9d67 into this branch, which moved the hunk. The baseline is green (optimizePlan.claimGain.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine17/packages/engine

 ❯ src/projection/optimizePlan.claimGain.evidence.test.ts (3 tests | 1 failed) 473ms
   ❯ claim-change-estate-gain — Claim-age co-optimization estate gain (3)
     × a plan whose claim change wins publishes the joint minus current estate, more than the $1,000 margin, in its last year's dollars 373ms

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
