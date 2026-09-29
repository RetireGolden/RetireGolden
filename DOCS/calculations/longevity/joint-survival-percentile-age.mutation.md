# Mutation receipt: joint-survival-percentile-age

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `2a93de55` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `476abd6e` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `df5da329` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/survival.ts`

```diff
diff --git a/packages/engine/src/montecarlo/survival.ts b/packages/engine/src/montecarlo/survival.ts
index 598b8cfa..e58e971d 100644
--- a/packages/engine/src/montecarlo/survival.ts
+++ b/packages/engine/src/montecarlo/survival.ts
@@ -239,3 +239,3 @@
   // inside the table (one past its last age), not only the primary.
-  for (let t = 0; from + t <= MAX_AGE + 1 || partnerFrom + t <= MAX_AGE + 1; t++) {
+  for (let t = 0; from + t <= MAX_AGE + 1; t++) {
     const sPrimary = primaryCurve.survivalTo(t)
```

Re-derived for decision D-PEOPLE-ORDER (rule R6): stop the walk when the primary passes the table's end, the rule before the decision, which cut a much younger partner's horizon short and depended on which person was passed first. The worksheet's case 2 (a man of 70 with a woman of 35, 25 percent) then returns 120 on his clock (2076) instead of 126 (2082), while the other way round still gives 2082, and the evidence fails there. The earlier mutation (both-alive instead of either-alive) tested case 1; this one tests the rule the record now adds, which case 1 does not reach. Carried onto main's walk over the 2023 life table when the branch merged main.

## Command

```
npx vitest run src/montecarlo/survival.evidence.test.ts
```

## Captured failing output

Re-derived when the branch merged main: this branch's R6 mutation, re-applied to main's walk over the 2023 life table. The baseline is green (survival.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/montecarlo/survival.evidence.test.ts (23 tests | 1 failed) 115ms
   ❯ joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock (6)
     × case 2: a partner 35 years younger is walked past his table end, 126 (2082) either way round 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > case 2: a partner 35 years younger is walked past his table end, 126 (2082) either way round
AssertionError: expected 120 to be 126 // Object.is equality

- Expected
+ Received

- 126
+ 120

 ❯ src/montecarlo/survival.evidence.test.ts:284:21
    282|       const younger = { age: 35, sex: 'female' as const }
    283|       const joint = jointSurvivalPercentileAge(older, younger, 25)
    284|       expect(joint).toBe(126)
       |                     ^
    285|       expect(2026 - older.age + joint).toBe(2082)
    286|       expect(2026 - younger.age + jointSurvivalPercentileAge(younger, …

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/survival.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
