# Mutation receipt: insight-hecm-buffer-illustrative-credit-line

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/hecmBufferCandidate.ts`

```diff
@@ -54,7 +54,7 @@ export const hecmBufferCandidate: Detector = {
     const pack = ctx.params
     const plfPct = hecmPrincipalLimitFactorPct(pack, youngestAge)
-    const lineSize = (plfPct / 100) * home.value
+    const lineSize = plfPct * home.value
     const patchedHome = {
       ...home,
```

This multiplies home value by 45 rather than 0.45, giving $18,000,000 — the worksheet's first wrong reading.

## Command

```
npx vitest run src/insights/detectors/hecmBufferCandidate.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/insights/detectors/hecmBufferCandidate.evidence.test.ts > insight-hecm-buffer-illustrative-credit-line — Illustrative HECM credit line for a house-rich, portfolio-thin plan > illustrates a $180,000 credit line against $400,000 investable at a 45% factor
AssertionError: creditLine 18000000 is not within {"abs":1e-9} of the worksheet's 180000: expected false to be true // Object.is equality
 ❯ src/insights/detectors/hecmBufferCandidate.evidence.test.ts:86:9
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/hecmBufferCandidate.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/hecmBufferCandidate.ts` exited 0, confirming no change to production code after the run.
