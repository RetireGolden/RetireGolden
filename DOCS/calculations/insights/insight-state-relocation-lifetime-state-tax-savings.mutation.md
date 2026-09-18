# Mutation receipt: insight-state-relocation-lifetime-state-tax-savings

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth) in `packages/engine`.

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

```
 FAIL  src/insights/detectors/stateRelocation.evidence.test.ts > insight-state-relocation-lifetime-state-tax-savings — Lifetime state-and-local tax saved by the best zero-tax relocation candidate > selects FL on the strict-< tie and publishes $6,000 of lifetime state-tax savings
AssertionError: expected 'Relocate to TX (illustrative)' to contain 'FL'
 ❯ src/insights/detectors/stateRelocation.evidence.test.ts:142:42
```

## Revert

`git checkout -- packages/engine/src/insights/detectors/stateRelocation.ts`, then `git diff --quiet -- packages/engine/src/insights/detectors/stateRelocation.ts` exited 0, confirming no change to production code after the run.
