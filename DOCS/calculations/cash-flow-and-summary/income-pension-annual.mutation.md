# Mutation receipt: income-pension-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `015a4b64` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts`

```diff
@@ -269,7 +269,7 @@ export function annualPensionAndAnnuityIncome(
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

The merge of main (c2d61967: #764, #765) into this branch moved the lines these receipts quote or the tests they capture; the mutations are unchanged. The baseline is green (annualPensionAndAnnuityIncome.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine21/packages/engine

 ❯ src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts (6 tests | 1 failed) 64ms
   ❯ income-pension-annual — Annual pension income, with COLA and survivor continuation (2)
     × continues 50 percent of a twice-COLAd pension to the survivor: 12730.80 32ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts > income-pension-annual — Annual pension income, with COLA and survivor continuation > continues 50 percent of a twice-COLAd pension to the survivor: 12730.80
AssertionError: pension: actual 25461.6, worksheet 12730.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts:103:9
    101|         withinTolerance(year.incomes.pension, expected.pension!, examp…
    102|         `pension: actual ${year.incomes.pension}, worksheet ${expected…
    103|       ).toBe(true)
       |         ^
    104|       // The worksheet's first wrong reading: the full post-COLA pensi…
    105|       // the owner dies. The third: gating on the deceased owner alone…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
