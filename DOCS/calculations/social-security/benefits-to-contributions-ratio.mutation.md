# Mutation receipt: benefits-to-contributions-ratio

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `b610eddc` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1b86d6af` (branch `claude/b2p1-slice4-ss-models`, pull request #757), and re-executed 2026-09-28 against RetireGolden base `a24a985a` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `8ccc9f8f` (branch `claude/ss-analysis-earnings-test`; no pull request is open yet), and re-executed 2026-09-30 against RetireGolden base `e51a4f00` (branch `claude/ss-review-fixes`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/analysis/oasdiReturn.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts b/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts
index d985dfe4..2d2714a5 100644
--- a/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts
+++ b/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts
@@ -257,6 +257,6 @@ export function oasdiReturnForPerson(plan: Plan, personId: string, options: FicaR
     paid,
     getBackPv,
     receivedBeforeStart,
-    ratio: benefitsToContributionsRatio(getBackPv + receivedBeforeStart, paid.paidInToday + paid.projectedToday),
+    ratio: benefitsToContributionsRatio(getBackPv, paid.paidInToday + paid.projectedToday),
   }
 }
```

This leaves out the benefits already received, the worksheet's third wrong reading (the derivation's problem 7): case A, not yet collecting, and case P are unchanged, but case B's ratio falls from 2.9290 to 2.3730 (2.93 to 2.37 on the page).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/analysis/oasdiReturn.ratio.evidence.test.ts
```

## Captured failing output

Re-executed after the different-family review of #769 added worked cases W and X to its test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (oasdiReturn.ratio.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/socialSecurity/analysis/oasdiReturn.ratio.evidence.test.ts (6 tests | 1 failed) 18ms
   ❯ benefits-to-contributions-ratio — Benefits received per dollar of Social Security tax paid (6)
     × case B: a person collecting since 2023 counts the three years already received (2.93, not 2.37) 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/analysis/oasdiReturn.ratio.evidence.test.ts > benefits-to-contributions-ratio — Benefits received per dollar of Social Security tax paid > case B: a person collecting since 2023 counts the three years already received (2.93, not 2.37)
AssertionError: B ratio: 2.3730272172907876 against the worksheet's 2.9290320080756196: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectValue src/socialSecurity/analysis/oasdiReturn.ratio.evidence.test.ts:60:120
     58| function expectValue(actual: number, label: string): void {
     59|   const expected = value(label)
     60|   expect(withinTolerance(actual, expected, { rel: 1e-12 }), `${label}:…
       |                                                                                                                        ^
     61| }
     62|
 ❯ src/socialSecurity/analysis/oasdiReturn.ratio.evidence.test.ts:97:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/analysis/oasdiReturn.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/analysis/oasdiReturn.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
