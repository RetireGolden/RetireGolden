# Mutation receipt: funded-ratio-household-start

Executed 2026-09-28 on branch `claude/people-order-and-scenarios` at base `1c7341f5` (no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6905169c` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `85e2fdb8` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/householdRetirement.ts`

```diff
diff --git a/packages/engine/src/projection/householdRetirement.ts b/packages/engine/src/projection/householdRetirement.ts
index b0a4a4f0..0d79d66f 100644
--- a/packages/engine/src/projection/householdRetirement.ts
+++ b/packages/engine/src/projection/householdRetirement.ts
@@ -102,3 +102,3 @@
       chosen === null ||
-      retirement.year > chosen.retirement.year ||
+      retirement.year < chosen.retirement.year ||
       (retirement.year === chosen.retirement.year &&
```

Count from the household's earlier retirement instead of the later one, the worksheet's second wrong reading. Case 1 then counts from 2027 on Robin's retirement instead of 2030 on Pat's, and the evidence fails there and on case 4 (2026 instead of 2031). Re-derived for the independent review's M4: the choice of the later retirement moved from ladder/fundedRatio.ts to the rule the FI figures, Coast-FIRE and the funded ratio now share, projection/householdRetirement.ts#householdLaterRetirement; the mutation is the same reading on the new line.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/ladder/fundedRatioStart.evidence.test.ts
```

## Captured failing output

Re-executed because the verification's fixes (N1 to N4) moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (fundedRatioStart.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/ladder/fundedRatioStart.evidence.test.ts (2 tests | 1 failed) 6ms
   ❯ funded-ratio-household-start — Funded ratio: the year the household floor starts to count (2)
     × counts from the later retirement, never before the start year, and names that person 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/ladder/fundedRatioStart.evidence.test.ts > funded-ratio-household-start — Funded ratio: the year the household floor starts to count > counts from the later retirement, never before the start year, and names that person
AssertionError: Case 1: expected 2027 to be 2030 // Object.is equality

- Expected
+ Received

- 2030
+ 2027

 ❯ src/ladder/fundedRatioStart.evidence.test.ts:55:39
     53|       for (const { label, people, wages, name } of CASES) {
     54|         const start = fundedRatioStart(household(people, wages), START)
     55|         expect(start.fromYear, label).toBe(expected(`${label} counting…
       |                                       ^
     56|         expect(start.personId, label).toBe(name?.toLowerCase() ?? null)
     57|       }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/householdRetirement.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/householdRetirement.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
