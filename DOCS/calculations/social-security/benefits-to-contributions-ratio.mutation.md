# Mutation receipt: benefits-to-contributions-ratio

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `b610eddc` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/analysis/oasdiReturn.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts b/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts
index daade33e..15d41929 100644
--- a/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts
+++ b/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts
@@ -240,6 +240,6 @@ export function oasdiReturnForPerson(plan: Plan, personId: string, options: FicaR
     paid,
     getBackPv,
     receivedBeforeStart,
-    ratio: benefitsToContributionsRatio(getBackPv + receivedBeforeStart, paid.paidInToday + paid.projectedToday),
+    ratio: benefitsToContributionsRatio(getBackPv, paid.paidInToday + paid.projectedToday),
   }
 }
```

This leaves out the benefits already received, the worksheet's third wrong reading (the derivation's problem 7): case A, not yet collecting, is unchanged, but case B's ratio falls from 2.85 to 2.30.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/analysis/oasdiReturn.ratio.evidence.test.ts
```

## Captured failing output

The slice's review fixes moved the lines around its hunk, renamed its module or changed its test file, so it is re-executed on the current code. The baseline is green (oasdiReturn.ratio.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine13/packages/engine

 ❯ src/socialSecurity/analysis/oasdiReturn.ratio.evidence.test.ts (5 tests | 1 failed) 11ms
   ❯ benefits-to-contributions-ratio — Benefits received per dollar of Social Security tax paid (5)
     × case B: a person collecting since 2023 counts the three years already received (2.85, not 2.30) 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/analysis/oasdiReturn.ratio.evidence.test.ts > benefits-to-contributions-ratio — Benefits received per dollar of Social Security tax paid > case B: a person collecting since 2023 counts the three years already received (2.85, not 2.30)
AssertionError: B ratio: 2.295122462644769 against the worksheet's 2.8511272534295995: expected false to be true // Object.is equality

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
