# Mutation receipt: insight-spending-guardrails-illustrative-floor

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/spendingGuardrails.ts`

```diff
diff --git a/packages/engine/src/insights/detectors/spendingGuardrails.ts b/packages/engine/src/insights/detectors/spendingGuardrails.ts
index 05de2a9d..acfa43e3 100644
--- a/packages/engine/src/insights/detectors/spendingGuardrails.ts
+++ b/packages/engine/src/insights/detectors/spendingGuardrails.ts
@@ -51,7 +51,8 @@ export const spendingGuardrails: Detector = {
 
     const generated = guardrailPatchFromGenerator(ctx.plan)
     if (!generated) return null
-    const { requiredAnnual, patch } = generated
+    const { requiredAnnual: generatedFloor, patch } = generated
+    const requiredAnnual = generatedFloor * 0.8
     const floorIsUserProvided =
       typeof ctx.plan.expenses.requiredAnnual === 'number' && Number.isFinite(ctx.plan.expenses.requiredAnnual)
     const evidence: [InsightEvidence, ...InsightEvidence[]] = [
```

Apply the 80% fallback ratio to an explicit floor as well (the worksheet's wrong reading): the explicit $42,000 floor publishes $33,600.

## Command

```
npx vitest run src/insights/detectors/spendingGuardrails.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-18 after the #720 review and the worksheet revision; the baseline is green (spendingGuardrails.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s6/packages/engine

 ❯ src/insights/detectors/spendingGuardrails.evidence.test.ts (4 tests | 3 failed) 16ms
   ❯ insight-spending-guardrails-illustrative-floor — Illustrative (or explicit) required spending floor for a guardrail preview (4)
     × falls back to 80% of $60,000 = $48,000 when no explicit floor is set 14ms
     × selects the explicit $42,000 floor without applying 80% again 1ms
     × screens a non-depleting plan with $150,000 first-year investable and publishes the $48,000 fallback floor 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/insights/detectors/spendingGuardrails.evidence.test.ts > insight-spending-guardrails-illustrative-floor — Illustrative (or explicit) required spending floor for a guardrail preview > falls back to 80% of $60,000 = $48,000 when no explicit floor is set
AssertionError: fallbackRequiredAnnual 38400 is not within {"abs":0.01} of the worksheet's 48000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/insights/detectors/spendingGuardrails.evidence.test.ts:80:9
     78|         withinTolerance(floor, expected, example.tolerance),
     79|         `fallbackRequiredAnnual ${floor} is not within ${JSON.stringif…
     80|       ).toBe(true)
       |         ^
     81|     })
     82|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/insights/detectors/spendingGuardrails.evidence.test.ts > insight-spending-guardrails-illustrative-floor — Illustrative (or explicit) required spending floor for a guardrail preview > selects the explicit $42,000 floor without applying 80% again
AssertionError: explicitRequiredAnnual 33600 is not within {"abs":0.01} of the worksheet's 42000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/insights/detectors/spendingGuardrails.evidence.test.ts:92:9
     90|         withinTolerance(floor, expected, example.tolerance),
     91|         `explicitRequiredAnnual ${floor} is not within ${JSON.stringif…
     92|       ).toBe(true)
       |         ^
     93|     })
     94|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/insights/detectors/spendingGuardrails.evidence.test.ts > insight-spending-guardrails-illustrative-floor — Illustrative (or explicit) required spending floor for a guardrail preview > screens a non-depleting plan with $150,000 first-year investable and publishes the $48,000 fallback floor
AssertionError: nonDepletingAboveThresholdRequiredAnnual 38400 is not within {"abs":0.01} of the worksheet's 48000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/insights/detectors/spendingGuardrails.evidence.test.ts:106:9
    104|         withinTolerance(floor, expected, example.tolerance),
    105|         `nonDepletingAboveThresholdRequiredAnnual ${floor} is not with…
    106|       ).toBe(true)
       |         ^
    107|     })
    108|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/spendingGuardrails.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/spendingGuardrails.ts` exited 0, confirming no change to production code after the run; the named suite passes again on the restored file.
