# Mutation receipt: insight-hecm-buffer-illustrative-credit-line

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/hecmBufferCandidate.ts`

```diff
@@ -54,5 +54,5 @@ export const hecmBufferCandidate: Detector = {
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

Re-executed for D-RECEIPT-DRIFT because its hunk header's line counts did not match the hunk; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (hecmBufferCandidate.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/insights/detectors/hecmBufferCandidate.evidence.test.ts (1 test | 1 failed) 17ms
   ❯ insight-hecm-buffer-illustrative-credit-line — Illustrative HECM credit line for a house-rich, portfolio-thin plan (1)
     × illustrates a $180,000 credit line against $400,000 investable at a 45% factor 16ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


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

The original bytes of `packages/engine/src/insights/detectors/hecmBufferCandidate.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/insights/detectors/hecmBufferCandidate.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
