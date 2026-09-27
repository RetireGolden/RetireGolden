# Mutation receipt: swr-rule-rate-and-initial-spend

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/swrComparator.ts`

```diff
diff --git a/packages/engine/src/decisions/swrComparator.ts b/packages/engine/src/decisions/swrComparator.ts
index fb930611..2fc56a28 100644
--- a/packages/engine/src/decisions/swrComparator.ts
+++ b/packages/engine/src/decisions/swrComparator.ts
@@ -54,6 +54,6 @@ export const SWR_RULES: readonly SwrRuleSpec[] = [
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

Re-executed for D-RECEIPT-DRIFT because its hunk header's line counts did not match the hunk and the test counts it stated no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (swrComparator.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/decisions/swrComparator.evidence.test.ts (6 tests | 1 failed) 85ms
   ❯ swr-rule-rate-and-initial-spend — Swr rule rate and initial spend (1)
     × prices Bengen, Morningstar and ERN at 47000, 39000 and 37500 on one million 50ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/swrComparator.evidence.test.ts > swr-rule-rate-and-initial-spend — Swr rule rate and initial spend > prices Bengen, Morningstar and ERN at 47000, 39000 and 37500 on one million
AssertionError: ern-cape rate: actual 5.75, worksheet 3.75: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/swrComparator.evidence.test.ts:28:160

 ❯ src/decisions/swrComparator.evidence.test.ts:27:12

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/swrComparator.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/swrComparator.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
