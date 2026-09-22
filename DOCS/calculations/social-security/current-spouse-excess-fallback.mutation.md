# Mutation receipt: current-spouse-excess-fallback

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualSocialSecurity.ts`

```diff
@@ -300,7 +300,7 @@ export function annualSocialSecurity(
         })
         const excessSpousalMonthly =
           guardedComponents?.auxiliaryMonthly ??
-          Math.max(0, rawSpousalMonthly - lowerOwnMonthly)
+          Math.max(0, (0.5 * higher.ss.pia - lower.ss.pia) * spousalFactor)
         const cappedExcessMonthly = capAuxiliaryForFamilyMaximum({
           workerPiaMonthly: higher.ss.pia,
           workerActualMonthly,
```

This puts the POMS order into the fallback arm, subtracting on unreduced PIAs before reducing, so the auxiliary becomes 1,250/3 and the combined benefit 3,850/3 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSocialSecurity.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualSocialSecurity.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts (6 tests | 2 failed) 37ms
   ❯ current-spouse-excess-fallback — Current-spouse excess: the annual phase's reduce-then-subtract fallback (2)
     × reduces the full spousal amount first, publishing a 1,150/3 auxiliary and a 1,250 combined benefit 4ms
     × differs from the POMS-order figure the paired worksheet publishes 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 4 passed (6)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > current-spouse-excess-fallback — Current-spouse excess: the annual phase's reduce-then-subtract fallback > reduces the full spousal amount first, publishing a 1,150/3 auxiliary and a 1,250 combined benefit
AssertionError: combinedMonthly 1283.3333333333335 is not within {"abs":1e-9} of the worksheet's 1250: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualSocialSecurity.evidence.test.ts:25:5
     23|     withinTolerance(actual, expected, tolerance),
     24|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     25|   ).toBe(true)
       |     ^
     26| }
     27|
 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:177:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualSocialSecurity.evidence.test.ts > current-spouse-excess-fallback — Current-spouse excess: the annual phase's reduce-then-subtract fallback > differs from the POMS-order figure the paired worksheet publishes
AssertionError: expected 1283.3333333333335 to be less than 1283.3333333333333
 ❯ src/projection/internal/annualSocialSecurity.evidence.test.ts:189:33
    187|       // The first wrong reading is the other worksheet's right answer…
    188|       // POMS order would publish 3,850/3 combined, not 1,250.
    189|       expect(claimantMonthly()).toBeLessThan(3_850 / 3)
       |                                 ^
    190|     })
    191|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualSocialSecurity.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualSocialSecurity.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
