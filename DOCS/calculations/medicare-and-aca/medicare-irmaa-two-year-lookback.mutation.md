# Mutation receipt: medicare-irmaa-two-year-lookback

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `aea4dac1` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/medicare.ts`

```diff
@@ -32,7 +32,7 @@ export function medicareAnnualPremiumPerPerson(
   at?: IrmaaThresholdYear,
   premiumScale = 1,
 ): MedicarePremiumResult {
-  const tier = irmaaTierForMagi(pack, magiTwoYearsPrior, filingStatus, at)
+  const tier = irmaaTierForMagi(pack, 0, filingStatus, at)
 
   const base = pack.medicare.partBStandardMonthly
   let partDSurchargeMonthly = 0
```

This ignores the resolved two-year-lookback MAGI the caller hands the module and tiers on a zero-MAGI year instead, which is what selecting 2025 or 2026 does on the worksheet's inputs: tier 0 rather than tier 1 — the worksheet's two wrong readings.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/medicare.evidence.test.ts
```

## Captured failing output

Decision D-2027-ROLLOVER moved the lines these receipts quote (the per-publisher parameter split and the pre-start warnings in projection/simulate.ts and its annual phases, imports added to evidence files) and restated six of the records; the mutations are unchanged. The baseline is green (medicare.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine21/packages/engine

 ❯ src/tax/medicare.evidence.test.ts (8 tests | 3 failed) 8ms
   ❯ medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary (3)
     × prices 109,001 at 35/25 of standard plus the 14.50 Part D surcharge 4ms
     × reads the applicable percentage as a share of program cost, not a surcharge 0ms
   ❯ medicare-irmaa-two-year-lookback — Medicare IRMAA two-year lookback (2)
     × reads 2024 MAGI to price a 2026 premium year 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 5 passed (8)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary > prices 109,001 at 35/25 of standard plus the 14.50 Part D surcharge
AssertionError: expected +0 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 0

 ❯ src/tax/medicare.evidence.test.ts:105:32
    103|       expect(firstTier.partDSurchargeMonthly).toBe(inputs.firstTierPar…
    104|       const result = medicareAnnualPremiumPerPerson(pack, inputs.lookb…
    105|       expect(result.irmaaTier).toBe(expected.aboveBoundary!.irmaaTier)
       |                                ^
    106|       for (const key of ['partBAnnual', 'partDSurchargeAnnual', 'irmaa…
    107|         expectWithin(result[key], expected.aboveBoundary![key]!, examp…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary > reads the applicable percentage as a share of program cost, not a surcharge
AssertionError: expected 2434.8 to be greater than 3286.9800000000005
 ❯ src/tax/medicare.evidence.test.ts:116:34
    114|       const result = medicareAnnualPremiumPerPerson(pack, inputs.lookb…
    115|       const surchargeReadingAnnual = pack.medicare.partBStandardMonthl…
    116|       expect(result.partBAnnual).toBeGreaterThan(surchargeReadingAnnua…
       |                                  ^
    117|     })
    118|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-two-year-lookback — Medicare IRMAA two-year lookback > reads 2024 MAGI to price a 2026 premium year
AssertionError: expected +0 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 0

 ❯ src/tax/medicare.evidence.test.ts:155:32
    153|       expect(pack.medicare.irmaaTiers[0]!.magiOver.single).toBe(inputs…
    154|       const result = medicareAnnualPremiumPerPerson(pack, selected, 's…
    155|       expect(result.irmaaTier).toBe(expected.irmaaTier)
       |                                ^
    156|       expect(irmaaTierForMagi(pack, selected, 'single')).toBe(expected…
    157|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/medicare.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/medicare.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
