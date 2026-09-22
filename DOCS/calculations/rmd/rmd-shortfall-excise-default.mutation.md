# Mutation receipt: rmd-shortfall-excise-default

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (rmdShortfallExcise.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/rmd/rmdShortfallExcise.evidence.test.ts (3 tests | 1 failed) 5ms
   ❯ rmd-shortfall-excise-default — RMD shortfall excise at the default rate (3)
     × prices a 6,000 shortfall at 25% into a 1,500 excise, with no relief elected 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/rmd/rmdShortfallExcise.evidence.test.ts > rmd-shortfall-excise-default — RMD shortfall excise at the default rate > prices a 6,000 shortfall at 25% into a 1,500 excise, with no relief elected
AssertionError: tax 600 is not within "exact" of the worksheet's 1500: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/rmd/rmdShortfallExcise.evidence.test.ts:19:5
     17|     withinTolerance(actual, expected, tolerance),
     18|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     19|   ).toBe(true)
       |     ^
     20| }
     21|
 ❯ src/rmd/rmdShortfallExcise.evidence.test.ts:58:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/rmd/rmdShortfallExcise.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/rmd/rmdShortfallExcise.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
