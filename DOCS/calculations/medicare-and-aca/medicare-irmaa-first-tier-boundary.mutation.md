# Mutation receipt: medicare-irmaa-first-tier-boundary

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

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

```
FAIL  src/tax/medicare.evidence.test.ts > medicare-irmaa-first-tier-boundary — Medicare IRMAA first-tier boundary > keeps 109,000 itself in tier 0: the test is strictly greater than
AssertionError: expected 1 to be +0 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/params/index.ts`, then `git diff --quiet -- packages/engine/src/params/index.ts` exited 0, confirming no change to production code after the run.
