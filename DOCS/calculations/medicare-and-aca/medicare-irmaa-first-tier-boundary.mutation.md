# Mutation receipt: medicare-irmaa-first-tier-boundary

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1d1cbbb9` (branch `claude/2027-published-figures`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `5f0bdbda` (branch `claude/2027-rollover`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `50327f81` (branch `claude/scrub-local-paths`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/params/index.ts`

```diff
@@ -480,7 +480,7 @@ export function irmaaTierForMagi(
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

Re-executed after the engine began reading CMS's published IRMAA tier premiums (2026-09-29): the evidence test gained a case per tier and new figures, which moved the lines, titles or counts this receipt quotes; the mutation is unchanged. The baseline is green (medicare.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/tax/medicare.evidence.test.ts (9 tests | 1 failed) 7ms
   ❯ medicare-irmaa-first-tier-boundary — Medicare IRMAA tier premiums and the first-tier boundary (4)
     × keeps 109,000 itself in tier 0: the test is strictly greater than 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-first-tier-boundary — Medicare IRMAA tier premiums and the first-tier boundary > keeps 109,000 itself in tier 0: the test is strictly greater than
AssertionError: expected 1 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 1

 ❯ src/tax/medicare.evidence.test.ts:94:32
     92|       expect(firstTier.magiOver.single).toBe(inputs.firstTierMagiOver)
     93|       const result = medicareAnnualPremiumPerPerson(pack, inputs.lookb…
     94|       expect(result.irmaaTier).toBe(expected.atBoundary!.irmaaTier)
       |                                ^
     95|       expectWithin(result.partBAnnual, expected.atBoundary!.partBAnnua…
     96|       expect(result.partDSurchargeAnnual).toBe(expected.atBoundary!.pa…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/params/index.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/params/index.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
