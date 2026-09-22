# Mutation receipt: income-pension-annual

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts`

```diff
@@ -266,7 +266,7 @@ export function annualPensionAndAnnuityIncome(
         amount = grown
         payeePersonId = ownerId
       } else if (survivor && ownerStartedBeforeDeath) {
-        amount = grown * (account.survivorPct / 100)
+        amount = grown
         payeePersonId = survivor.personId
       }
       if (payeePersonId === null) continue
```

This pays the surviving spouse the full post-COLA pension, publishing $25,461.60 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts > income-pension-annual — Annual pension income, with COLA and survivor continuation > continues 50 percent of a twice-COLAd pension to the survivor: 12730.80
AssertionError: pension: actual 25461.6, worksheet 12730.8: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts` exited 0, confirming no change to production code after the run.
