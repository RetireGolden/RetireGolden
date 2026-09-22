# Mutation receipt: income-annuity-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts`

```diff
@@ -315,7 +315,7 @@ export function annualPensionAndAnnuityIncome(
     })
     if (paidFraction <= 0) continue
 
-    const paid = grown * paidFraction
+    const paid = grown
     annuityIncome += paid
     let annuityTaxable: number
     let nonqualifiedExcludable = 0
```

This ignores the payout form's fraction, paying the joint annuitant the full post-COLA amount of $18,360 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualPensionAndAnnuityIncome.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts (4 tests | 1 failed) 37ms
   ❯ income-annuity-annual — Annual annuity income under the joint-survivor payout form (2)
     × continues 60 percent of a once-COLAd annuity to the joint annuitant: 11016.00 6ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)

  Transform  transforming modules took 2.15s · 45% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts > income-annuity-annual — Annual annuity income under the joint-survivor payout form > continues 60 percent of a once-COLAd annuity to the joint annuitant: 11016.00
AssertionError: annuity: actual 18360, worksheet 11016: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/annualPensionAndAnnuityIncome.evidence.test.ts:174:9
    172|         withinTolerance(year.incomes.annuity, expected.annuity!, examp…
    173|         `annuity: actual ${year.incomes.annuity}, worksheet ${expected…
    174|       ).toBe(true)
       |         ^
    175|       // The worksheet's three wrong readings: life-only behaviour pay…
    176|       // the full post-COLA amount, and 60% of the monthly amount with…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
