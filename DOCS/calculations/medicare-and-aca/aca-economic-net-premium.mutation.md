# Mutation receipt: aca-economic-net-premium

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `a5d07d32` (branch `claude/aca-2027-coverage-year`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/aca.ts`

```diff
@@ -248,7 +248,7 @@ export function acaEconomicPremiumByMonth(
     if (enrollment <= 0 || benchmark <= 0) continue
     modeledAllowablePtc += Math.min(enrollment, Math.max(0, benchmark - expectedContribution / 12))
   }
-  const economicNetPremium = grossEnrollmentPremium - modeledAllowablePtc
+  const economicNetPremium = applicableSlcspPremium - modeledAllowablePtc
   return {
     fplPct,
     expectedContribution,
```

This subtracts the credit from the SLCSP benchmark rather than the gross enrollment premium, publishing $2,791.80 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/aca.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (aca.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/tax/aca.evidence.test.ts (14 tests | 2 failed) 8ms
   ❯ aca-economic-net-premium — ACA economic net premium (2)
     × bears 791.80 of the 10,000 gross premium after a 9,208.20 credit 4ms
     × never falls below zero, because each month's credit is capped at that month's premium 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 12 passed (14)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-economic-net-premium — ACA economic net premium > bears 791.80 of the 10,000 gross premium after a 9,208.20 credit
AssertionError: economicNetPremium 2791.7999999999975 is not within {"abs":0.005} of the worksheet's 791.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/aca.evidence.test.ts:28:5
     26|     withinTolerance(actual, expected, tolerance),
     27|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     28|   ).toBe(true)
       |     ^
     29| }
     30|
 ❯ src/tax/aca.evidence.test.ts:290:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-economic-net-premium — ACA economic net premium > never falls below zero, because each month's credit is capped at that month's premium
AssertionError: expected 10800 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 10800

 ❯ src/tax/aca.evidence.test.ts:308:41
    306|         byMonth(inputs.applicableSlcspPremium!),
    307|       )
    308|       expect(result.economicNetPremium).toBe(0)
       |                                         ^
    309|     })
    310|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/aca.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/aca.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
