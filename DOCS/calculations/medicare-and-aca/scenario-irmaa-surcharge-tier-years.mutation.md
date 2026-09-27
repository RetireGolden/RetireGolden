# Mutation receipt: scenario-irmaa-surcharge-tier-years

Executed 2026-09-17 against RetireGolden base `b99ac29b` (branch grok/b1-p4-cards-insights-ss-medicare-roth), and re-executed 2026-09-26 against RetireGolden base `5d3a72b1` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c780ae5` (branch `claude/solver-answers-unpriced-aca`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/scenarios/comparison.ts`

```diff
@@ -722,6 +722,6 @@ export function compareScenarioPlans(
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

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from and its hunk header's line counts did not match the hunk; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (comparison.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/scenarios/comparison.evidence.test.ts (1 test | 1 failed) 14ms
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
