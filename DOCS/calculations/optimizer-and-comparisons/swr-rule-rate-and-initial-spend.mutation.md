# Mutation receipt: swr-rule-rate-and-initial-spend

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/swrComparator.ts`

```diff
diff --git a/packages/engine/src/decisions/swrComparator.ts b/packages/engine/src/decisions/swrComparator.ts
index 567dc9ee..38da26dc 100644
--- a/packages/engine/src/decisions/swrComparator.ts
+++ b/packages/engine/src/decisions/swrComparator.ts
@@ -54,7 +54,7 @@ export const SWR_RULES: readonly SwrRuleSpec[] = [
     id: 'ern-cape',
     label: 'ERN CAPE rule',
     citation: 'Early Retirement Now, SWR series part 18: SWR = 1.75% + 0.5 × (100 ÷ CAPE).',
-    initialRatePct: (cape) => 1.75 + 0.5 * (100 / cape),
+    initialRatePct: (cape) => 1.75 + (100 / cape),
   },
 ]
```

Omit the half multiplier on cyclically adjusted earnings yield.

## Command

```
npx.cmd vitest run src/decisions/swrComparator.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/decisions/swrComparator.evidence.test.ts (1 test | 1 failed) 51ms
   ❯ swr-rule-rate-and-initial-spend — Swr rule rate and initial spend (1)
     × prices Bengen, Morningstar and ERN at 47000, 39000 and 37500 on one million 50ms

 Test Files  1 failed (1)
      Tests  1 failed (1)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-rate-and-initial-spend — Swr rule rate and initial spend > prices Bengen, Morningstar and ERN at 47000, 39000 and 37500 on one million
AssertionError: ern-cape rate: actual 5.75, worksheet 3.75: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/swrComparator.evidence.test.ts:23:160

 ❯ src/decisions/swrComparator.evidence.test.ts:22:12

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/decisions/swrComparator.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration. The restored named file passed (exit 0).
