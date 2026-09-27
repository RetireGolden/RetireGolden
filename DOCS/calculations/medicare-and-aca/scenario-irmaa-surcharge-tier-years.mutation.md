# Mutation receipt: scenario-irmaa-surcharge-tier-years

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-26 against RetireGolden base `5d3a72b1` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c780ae5` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `b2897dfe` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/scenarios/comparison.ts`

```diff
@@ -757,6 +757,6 @@ export function compareScenarioPlans(
         sum(proposalResult.years, (y) => y.medicarePremiums),
       ),
       surchargeTierYears: scalar(
-        baselineResult.years.filter((y) => y.irmaaTier > 0).length,
-        proposalResult.years.filter((y) => y.irmaaTier > 0).length,
+        baselineResult.years.filter((y) => y.irmaaTier >= 0).length,
+        proposalResult.years.filter((y) => y.irmaaTier >= 0).length,
       ),
```

This counts tier 0 as a surcharge year, so both sides have 5 years — the worksheet's second wrong reading.

## Command

```
npx vitest run src/scenarios/comparison.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after merging RetireGolden #751 into B2-P1 slice 2: the drift check #751 adds flagged this receipt against the slice's code (a hunk header naming a line the code has moved from, a context line the slice changed, a header naming no line, or a stated test count the slice's evidence file no longer has), so the diff header, capture, blob hash and revert note are refreshed against this head. The baseline is green (comparison.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/scenarios/comparison.evidence.test.ts (1 test | 1 failed) 13ms
   ❯ scenario-irmaa-surcharge-tier-years — Scenario comparison: years in an IRMAA surcharge tier (1)
     × counts 3 baseline and 2 proposal surcharge-tier years (delta −1) 13ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/scenarios/comparison.evidence.test.ts > scenario-irmaa-surcharge-tier-years — Scenario comparison: years in an IRMAA surcharge tier > counts 3 baseline and 2 proposal surcharge-tier years (delta −1)
AssertionError: expected 5 to be 3 // Object.is equality

- Expected
+ Received

- 3
+ 5

 ❯ src/scenarios/comparison.evidence.test.ts:161:60
    159|         taxCalculatorForPlan: () => ({ compute: () => ({ amount: 0 }) …
    160|       })
    161|       expect(comparison.irmaa.surchargeTierYears.baseline).toBe(exampl…
       |                                                            ^
    162|       expect(comparison.irmaa.surchargeTierYears.proposal).toBe(exampl…
    163|       expect(comparison.irmaa.surchargeTierYears.delta).toBe(example.e…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/scenarios/comparison.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/scenarios/comparison.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
