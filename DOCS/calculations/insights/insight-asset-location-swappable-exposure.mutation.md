# Mutation receipt: insight-asset-location-swappable-exposure

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/assetLocation.ts`

```diff
diff --git a/packages/engine/src/insights/detectors/assetLocation.ts b/packages/engine/src/insights/detectors/assetLocation.ts
index 1c8c3094..94147d60 100644
--- a/packages/engine/src/insights/detectors/assetLocation.ts
+++ b/packages/engine/src/insights/detectors/assetLocation.ts
@@ -64,8 +64,11 @@ export const assetLocation: Detector = {
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

Re-executed 2026-09-18 after the #720 review and the worksheet revision; the baseline is green (assetLocation.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s6/packages/engine

 ❯ src/insights/detectors/assetLocation.evidence.test.ts (2 tests | 2 failed) 15ms
   ❯ insight-asset-location-swappable-exposure — Swappable class exposure of the preferred asset-location candidate (2)
     × publishes the preferred id's $120,000 exposure even though a later candidate has $150,000 14ms
     × publishes the first candidate's $70,000 exposure when the preferred id is absent 1ms

 Test Files  1 failed (1)
      Tests  2 failed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/insights/detectors/assetLocation.evidence.test.ts > insight-asset-location-swappable-exposure — Swappable class exposure of the preferred asset-location candidate > publishes the preferred id's $120,000 exposure even though a later candidate has $150,000
AssertionError: swappableExposure 150000 is not within {"abs":1e-9} of the worksheet's 120000: expected false to be true // Object.is equality

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
AssertionError: swappableExposure 200000 is not within {"abs":1e-9} of the worksheet's 70000: expected false to be true // Object.is equality

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

`git checkout -- packages/engine/src/insights/detectors/assetLocation.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/assetLocation.ts` exited 0, confirming no change to production code after the run; the named suite passes again on the restored file.
