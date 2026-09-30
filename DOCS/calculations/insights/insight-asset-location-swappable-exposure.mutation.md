# Mutation receipt: insight-asset-location-swappable-exposure

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-27 against RetireGolden base `e73e5175` (branch `claude/b2p1-slice3-comparisons`, pull request #754) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/assetLocation.ts`

```diff
diff --git a/packages/engine/src/insights/detectors/assetLocation.ts b/packages/engine/src/insights/detectors/assetLocation.ts
index 9d8db6f5..ab3cc5b6 100644
--- a/packages/engine/src/insights/detectors/assetLocation.ts
+++ b/packages/engine/src/insights/detectors/assetLocation.ts
@@ -65,8 +65,11 @@ export const assetLocation: Detector = {
     const candidates = assetLocationGenerator.generate({ plan: ctx.plan } as DecisionContext)
     if (candidates.length === 0) return null
 
-    const preferred =
-      candidates.find((candidate) => candidate.id === 'asset-location-bonds-to-traditional') ?? candidates[0]!
+    const preferred = candidates.reduce((best, candidate) => {
+      const exposure = (candidate.metadata?.swappedDollars as number | undefined) ?? 0
+      const bestExposure = (best.metadata?.swappedDollars as number | undefined) ?? 0
+      return exposure > bestExposure ? candidate : best
+    }, candidates[0]!)
     const swapped = (preferred.metadata?.swappedDollars as number | undefined) ?? 0
 
     return {
```

Select the candidate with the largest swappedDollars instead of the preferred id (the worksheet's first wrong reading): case (a) publishes the $150,000 candidate instead of the preferred $120,000 one, and case (b) publishes the $200,000 candidate instead of the first.

## Command

```
npx vitest run src/insights/detectors/assetLocation.evidence.test.ts
```

## Captured failing output

The PR #754 follow-up review typed two refusals (MonteCarloComparisonRefusal in the success comparison, InsightPreviewUnavailable in the detectors that find nothing to preview) and added their imports, so the hunk headers are re-pointed. The baseline is green (assetLocation.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/insights/detectors/assetLocation.evidence.test.ts (2 tests | 2 failed) 14ms
   ❯ insight-asset-location-swappable-exposure — Swappable class exposure of the preferred asset-location candidate (2)
     × publishes the preferred id's $120,000 exposure even though a later candidate has $150,000 13ms
     × publishes the first candidate's $70,000 exposure when the preferred id is absent 1ms

 Test Files  1 failed (1)
      Tests  2 failed (2)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/insights/detectors/assetLocation.evidence.test.ts > insight-asset-location-swappable-exposure — Swappable class exposure of the preferred asset-location candidate > publishes the preferred id's $120,000 exposure even though a later candidate has $150,000
AssertionError: swappableExposure 150000 is not within "exact" of the worksheet's 120000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/insights/detectors/assetLocation.evidence.test.ts:131:9
    129|         withinTolerance(exposure, expected, example.tolerance),
    130|         `swappableExposure ${exposure} is not within ${JSON.stringify(…
    131|       ).toBe(true)
       |         ^
    132|     })
    133|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/insights/detectors/assetLocation.evidence.test.ts > insight-asset-location-swappable-exposure — Swappable class exposure of the preferred asset-location candidate > publishes the first candidate's $70,000 exposure when the preferred id is absent
AssertionError: swappableExposure 200000 is not within "exact" of the worksheet's 70000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/insights/detectors/assetLocation.evidence.test.ts:150:9
    148|         withinTolerance(exposure, expected, example.tolerance),
    149|         `swappableExposure ${exposure} is not within ${JSON.stringify(…
    150|       ).toBe(true)
       |         ^
    151|     })
    152|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/insights/detectors/assetLocation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/insights/detectors/assetLocation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
