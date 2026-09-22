# Mutation receipt: rmd-shortfall-excise-default

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/rmd/rmdShortfallExcise.ts`

```diff
@@ -344,8 +344,8 @@ export function computeRmdShortfallExcise(
       rate = RMD_SHORTFALL_PRE_SECURE_2_RATE
       reason = 'preSecure2Default50Percent'
     } else {
-      rate = RMD_SHORTFALL_DEFAULT_RATE
-      reason = 'default25Percent'
+      rate = RMD_SHORTFALL_CORRECTED_RATE
+      reason = 'corrected10Percent'
     }
   }
 
```

This applies the corrected 10% rate with no qualifying correction, publishing $600 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/rmd/rmdShortfallExcise.evidence.test.ts
```

## Captured failing output

```
FAIL  src/rmd/rmdShortfallExcise.evidence.test.ts > rmd-shortfall-excise-default — RMD shortfall excise at the default rate > prices a 6,000 shortfall at 25% into a 1,500 excise, with no relief elected
AssertionError: tax 600 is not within "exact" of the worksheet's 1500: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/rmd/rmdShortfallExcise.ts`, then `git diff --quiet -- packages/engine/src/rmd/rmdShortfallExcise.ts` exited 0, confirming no change to production code after the run.
