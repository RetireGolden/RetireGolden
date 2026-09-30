# Mutation receipt: insight-spending-guardrails-illustrative-floor

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-27 against RetireGolden base `373a40f0` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/spendingGuardrails.ts`

```diff
diff --git a/packages/engine/src/insights/detectors/spendingGuardrails.ts b/packages/engine/src/insights/detectors/spendingGuardrails.ts
index 8e97c4af..0adf647a 100644
--- a/packages/engine/src/insights/detectors/spendingGuardrails.ts
+++ b/packages/engine/src/insights/detectors/spendingGuardrails.ts
@@ -54,7 +54,8 @@ export const spendingGuardrails: Detector = {
 
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

Re-executed 2026-09-27 on B2-P1 slice 3, which moved the lines this receipt quotes (new comparison fields, basis doc comments and helper calls in the production file, or new cases and fixture fields in the evidence file) without changing the mutation, so the hunk header, capture, blob hash and revert note are refreshed against this head. The baseline is green (spendingGuardrails.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/insights/detectors/spendingGuardrails.evidence.test.ts (4 tests | 3 failed) 15ms
   ❯ insight-spending-guardrails-illustrative-floor — Illustrative (or explicit) required spending floor for a guardrail preview (4)
     × falls back to 80% of $60,000 = $48,000 when no explicit floor is set 13ms
     × selects the explicit $42,000 floor without applying 80% again 1ms
     × screens a non-depleting plan with $150,000 first-year investable and publishes the $48,000 fallback floor 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/insights/detectors/spendingGuardrails.evidence.test.ts > insight-spending-guardrails-illustrative-floor — Illustrative (or explicit) required spending floor for a guardrail preview > falls back to 80% of $60,000 = $48,000 when no explicit floor is set
AssertionError: fallbackRequiredAnnual 38400 is not within "exact" of the worksheet's 48000: expected false to be true // Object.is equality

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
AssertionError: explicitRequiredAnnual 33600 is not within "exact" of the worksheet's 42000: expected false to be true // Object.is equality

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
AssertionError: nonDepletingAboveThresholdRequiredAnnual 38400 is not within "exact" of the worksheet's 48000: expected false to be true // Object.is equality

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

The original bytes of `packages/engine/src/insights/detectors/spendingGuardrails.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/insights/detectors/spendingGuardrails.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
