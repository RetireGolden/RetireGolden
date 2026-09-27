# Mutation receipt: insight-state-relocation-lifetime-state-tax-savings

Executed 2026-09-17 and re-executed 2026-09-18 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/insights/detectors/stateRelocation.ts`

```diff
@@ -151,3 +151,3 @@ export const stateRelocation: Detector = {
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

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from and its hunk header's line counts did not match the hunk; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (stateRelocation.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/insights/detectors/stateRelocation.evidence.test.ts (1 test | 1 failed) 14ms
   ❯ insight-state-relocation-lifetime-state-tax-savings — Lifetime state-and-local tax saved by the best zero-tax relocation candidate (1)
     × selects FL on the strict-< tie and publishes $6,000 of lifetime state-tax savings 13ms

 Test Files  1 failed (1)
      Tests  1 failed (1)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


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

The original bytes of `packages/engine/src/insights/detectors/stateRelocation.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/insights/detectors/stateRelocation.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
