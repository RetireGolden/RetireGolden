# Mutation receipt: insight-spending-guardrails-illustrative-floor

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/spendingGuardrails.ts`

```diff
@@ -52,7 +52,8 @@ export const spendingGuardrails: Detector = {
     const generated = guardrailPatchFromGenerator(ctx.plan)
     if (!generated) return null
-    const { requiredAnnual, patch } = generated
+    const { requiredAnnual: generatedFloor, patch } = generated
+    const requiredAnnual = generatedFloor * 0.8
     const floorIsUserProvided =
```

This applies 80% a second time, so the fallback floor becomes $38,400 and the explicit floor $33,600 — the worksheet's second wrong reading of applying 80% to the explicit floor.

## Command

```
npx vitest run src/insights/detectors/spendingGuardrails.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/insights/detectors/spendingGuardrails.evidence.test.ts > insight-spending-guardrails-illustrative-floor — Illustrative (or explicit) required spending floor for a guardrail preview > falls back to 80% of $60,000 = $48,000 when no explicit floor is set
AssertionError: fallbackRequiredAnnual 38400 is not within {"abs":0.01} of the worksheet's 48000: expected false to be true // Object.is equality
 ❯ src/insights/detectors/spendingGuardrails.evidence.test.ts:59:9
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/spendingGuardrails.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/spendingGuardrails.ts` exited 0, confirming no change to production code after the run.
