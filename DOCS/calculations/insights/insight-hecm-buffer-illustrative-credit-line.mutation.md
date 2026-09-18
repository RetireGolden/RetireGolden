# Mutation receipt: insight-hecm-buffer-illustrative-credit-line

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

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

Re-executed 2026-09-18 after the evidence fixture moved to the exact tolerance on the published whole-dollar figure (round three of the #720 review). The baseline is green (hecmBufferCandidate.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s6/packages/engine

 ❯ src/insights/detectors/hecmBufferCandidate.evidence.test.ts (1 test | 1 failed) 15ms
   ❯ insight-hecm-buffer-illustrative-credit-line — Illustrative HECM credit line for a house-rich, portfolio-thin plan (1)
     × illustrates a $180,000 credit line against $400,000 investable at a 45% factor 14ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/insights/detectors/hecmBufferCandidate.evidence.test.ts > insight-hecm-buffer-illustrative-credit-line — Illustrative HECM credit line for a house-rich, portfolio-thin plan > illustrates a $180,000 credit line against $400,000 investable at a 45% factor
AssertionError: creditLine 18000000 is not within "exact" of the worksheet's 180000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/insights/detectors/hecmBufferCandidate.evidence.test.ts:86:9
     84|         withinTolerance(creditLine, expectedLine, example.tolerance),
     85|         `creditLine ${creditLine} is not within ${JSON.stringify(examp…
     86|       ).toBe(true)
       |         ^
     87|       expect(
     88|         withinTolerance(investable, expectedInvestable, example.tolera…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/hecmBufferCandidate.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/hecmBufferCandidate.ts` exited 0, confirming no change to production code after the run.
