# Mutation receipt: medicare-irmaa-first-tier-boundary

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/params/index.ts`

```diff
@@ -342,7 +342,7 @@ export function irmaaTierForMagi(
     const threshold = irmaaTierThreshold(pack, i, filingStatus, at)
     const isTopTier = i === pack.medicare.irmaaTiers.length - 1
     // CMS publishes lower tiers as "greater than" the floor; the final tier is inclusive.
-    if (isTopTier ? magiTwoYearsPrior >= threshold : magiTwoYearsPrior > threshold) tier = i + 1
+    if (magiTwoYearsPrior >= threshold) tier = i + 1
   }
   return tier
 }
```

This makes every tier test inclusive, so MAGI of exactly $109,000 lands in tier 1 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/medicare.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (medicare.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/tax/medicare.evidence.test.ts (7 tests | 1 failed) 6ms
   ❯ medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary (3)
     × keeps 109,000 itself in tier 0: the test is strictly greater than 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary > keeps 109,000 itself in tier 0: the test is strictly greater than
AssertionError: expected 1 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 1

 ❯ src/tax/medicare.evidence.test.ts:93:32
     91|       expect(firstTier.magiOver.single).toBe(inputs.firstTierMagiOver)
     92|       const result = medicareAnnualPremiumPerPerson(pack, inputs.lookb…
     93|       expect(result.irmaaTier).toBe(expected.atBoundary!.irmaaTier)
       |                                ^
     94|       expectWithin(result.partBAnnual, expected.atBoundary!.partBAnnua…
     95|       expect(result.partDSurchargeAnnual).toBe(expected.atBoundary!.pa…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/params/index.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/params/index.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
