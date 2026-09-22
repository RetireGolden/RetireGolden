# Mutation receipt: insight-state-relocation-lifetime-state-tax-savings

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/stateRelocation.ts`

```diff
@@ -106,7 +106,7 @@ export const stateRelocation: Detector = {
       const candidates = comparison.rows.filter((r) => r.id !== 'baseline' && r.error === null)
       if (!baseline || candidates.length === 0) throw new Error('Relocation sweep produced no valid candidates')
-      const best = candidates.reduce((a, b) => (b.lifetimeTaxesAndPenalties < a.lifetimeTaxesAndPenalties ? b : a))
+      const best = candidates.reduce((a, b) => (b.lifetimeTaxesAndPenalties <= a.lifetimeTaxesAndPenalties ? b : a))
```

This lets TX replace FL on an equal lifetime-tax total, ignoring the strict-`<` tie rule and shortlist order — the worksheet's fourth wrong reading.

## Command

```
npx vitest run src/insights/detectors/stateRelocation.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-18 after the evidence fixture moved to the exact tolerance on the published whole-dollar figure (round three of the #720 review). The baseline is green (stateRelocation.evidence.test.ts passes on unmodified production). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-s6/packages/engine

 ❯ src/insights/detectors/stateRelocation.evidence.test.ts (1 test | 1 failed) 14ms
   ❯ insight-state-relocation-lifetime-state-tax-savings — Lifetime state-and-local tax saved by the best zero-tax relocation candidate (1)
     × selects FL on the strict-< tie and publishes $6,000 of lifetime state-tax savings 13ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/insights/detectors/stateRelocation.evidence.test.ts > insight-state-relocation-lifetime-state-tax-savings — Lifetime state-and-local tax saved by the best zero-tax relocation candidate > selects FL on the strict-< tie and publishes $6,000 of lifetime state-tax savings
AssertionError: expected 'Relocate to TX (illustrative)' to contain 'FL'

Expected: "FL"
Received: "Relocate to TX (illustrative)"

 ❯ src/insights/detectors/stateRelocation.evidence.test.ts:142:42
    140|       expect(result.action.kind).toBe('preview-scenario')
    141|       if (result.action.kind !== 'preview-scenario') throw new Error('…
    142|       expect(result.action.scenarioName).toContain(example.expected.se…
       |                                          ^
    143|       const qualitative = result.impact?.qualitative ?? ''
    144|       const match = qualitative.match(/\$[\d,]+/u)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/stateRelocation.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/stateRelocation.ts` exited 0, confirming no change to production code after the run.
