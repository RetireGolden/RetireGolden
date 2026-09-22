# Mutation receipt: medicare-irmaa-two-year-lookback

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/medicare.ts`

```diff
@@ -39,7 +39,7 @@ export function medicareAnnualPremiumPerPerson(
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

```
FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-two-year-lookback — Medicare IRMAA two-year lookback > reads 2024 MAGI to price a 2026 premium year
AssertionError: expected +0 to be 1 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/tax/medicare.ts`, then `git diff --quiet -- packages/engine/src/tax/medicare.ts` exited 0, confirming no change to production code after the run.
