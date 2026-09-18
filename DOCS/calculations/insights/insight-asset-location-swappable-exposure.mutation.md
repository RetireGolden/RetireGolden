# Mutation receipt: insight-asset-location-swappable-exposure

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/assetLocation.ts`

```diff
@@ -55,8 +55,11 @@ export const assetLocation: Detector = {
     if (candidates.length === 0) return null

-    const preferred =
-      candidates.find((candidate) => candidate.id === 'asset-location-bonds-to-traditional') ?? candidates[0]!
+    const preferred = candidates.reduce((best, candidate) => {
+      const exposure = (candidate.metadata?.swappedDollars as number | undefined) ?? 0
+      const bestExposure = (best.metadata?.swappedDollars as number | undefined) ?? 0
+      return exposure > bestExposure ? candidate : best
+    }, candidates[0]!)
     const swapped = (preferred.metadata?.swappedDollars as number | undefined) ?? 0
```

This selects the largest swappable exposure regardless of benefit, so candidate C's $150,000 is published — the worksheet's first wrong reading.

## Command

```
npx vitest run src/insights/detectors/assetLocation.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/insights/detectors/assetLocation.evidence.test.ts > insight-asset-location-swappable-exposure — Swappable class exposure of the preferred asset-location candidate > publishes candidate A's $80,000 swappable exposure, not C's larger harmful exposure
AssertionError: swappableExposure 150000 is not within {"abs":1e-9} of the worksheet's 80000: expected false to be true // Object.is equality
 ❯ src/insights/detectors/assetLocation.evidence.test.ts:97:9
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/assetLocation.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/assetLocation.ts` exited 0, confirming no change to production code after the run.
