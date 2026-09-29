# Mutation receipt: aca-contract-premium-basis

Executed 2026-09-28 against RetireGolden base `54306786` (branch `claude/mc-provenance-and-seed`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `22d33849` (branch `claude/mc-provenance-and-seed`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `da378d9b` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `8f562339` (branch `claude/people-order-and-scenarios`, pull request #765) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/effectiveAcaYearContract.ts`

```diff
diff --git a/packages/engine/src/projection/internal/effectiveAcaYearContract.ts b/packages/engine/src/projection/internal/effectiveAcaYearContract.ts
index 661f34dd..4cac8c57 100644
--- a/packages/engine/src/projection/internal/effectiveAcaYearContract.ts
+++ b/packages/engine/src/projection/internal/effectiveAcaYearContract.ts
@@ -96,5 +96,5 @@ export function effectiveAcaYearContract(
 ): EffectiveAcaYearContract {
   if (contract.premiumBasis === 'premiumField') {
-    const monthlyPremium = input.plan.expenses.healthcare.pre65MonthlyPremiumPerPerson * input.healthInflFactor
+    const monthlyPremium = input.plan.expenses.healthcare.pre65MonthlyPremiumPerPerson
     const living = input.peopleStates
       .map((state, position) => ({ state, position }))
```

Fill a premium-field contract's premiums from the premium field without the run's healthcare factor, the worksheet's first wrong reading. The start year is unaffected (its factor is 1), so the 2026 figures still pass; 2027 prices 12 x 800 = 9,600 instead of 10,032 at the plan rates and instead of 10,080 on the inflation path, and the evidence fails there.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/effectiveAcaYearContract.evidence.test.ts
```

## Captured failing output

Re-executed because the round-one review of #765 moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (effectiveAcaYearContract.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/projection/internal/effectiveAcaYearContract.evidence.test.ts (3 tests | 2 failed) 109ms
   ❯ aca-contract-premium-basis — Premium-credit contract as a run prices it: premium basis and deaths (3)
     × fills a premium-field contract for each run and year from the premium field, the state and the people alive 58ms
     × holds a stated contract as written and stops charging a member after the death year 29ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/effectiveAcaYearContract.evidence.test.ts > aca-contract-premium-basis — Premium-credit contract as a run prices it: premium basis and deaths > fills a premium-field contract for each run and year from the premium field, the state and the people alive
AssertionError: A 2027 gross enrollment premium, plan rates: 9600 against 10032: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectDollars src/projection/internal/effectiveAcaYearContract.evidence.test.ts:78:118
     76|
     77| function expectDollars(actual: number, label: string): void {
     78|   expect(withinTolerance(actual, expected(label), { abs: 0.005 }), `${…
       |                                                                                                                      ^
     79| }
     80|
 ❯ src/projection/internal/effectiveAcaYearContract.evidence.test.ts:108:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/effectiveAcaYearContract.evidence.test.ts > aca-contract-premium-basis — Premium-credit contract as a run prices it: premium basis and deaths > holds a stated contract as written and stops charging a member after the death year
AssertionError: B-derived 2027 gross enrollment premium: 8400 against 8778: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectDollars src/projection/internal/effectiveAcaYearContract.evidence.test.ts:78:118
     76|
     77| function expectDollars(actual: number, label: string): void {
     78|   expect(withinTolerance(actual, expected(label), { abs: 0.005 }), `${…
       |                                                                                                                      ^
     79| }
     80|
 ❯ src/projection/internal/effectiveAcaYearContract.evidence.test.ts:126:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/effectiveAcaYearContract.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/effectiveAcaYearContract.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
