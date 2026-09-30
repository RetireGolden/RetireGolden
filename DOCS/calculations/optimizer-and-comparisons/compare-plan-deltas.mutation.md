# Mutation receipt: plan-headline-longevity-comparison

Executed 2026-09-27 against RetireGolden base `a1fd6d59` (branch `claude/b2p1-slice3-comparisons`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1c7341f5` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `6905169c` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/moneyLasts.ts`

```diff
diff --git a/packages/engine/src/projection/moneyLasts.ts b/packages/engine/src/projection/moneyLasts.ts
index dafbd67c..7cd5e215 100644
--- a/packages/engine/src/projection/moneyLasts.ts
+++ b/packages/engine/src/projection/moneyLasts.ts
@@ -105,7 +105,7 @@ export function compareMoneyLasts(
   const right = moneyLasts(proposal)
   const leftFull = left.depletionYear === null
   const rightFull = right.depletionYear === null
-  if (leftFull && rightFull) return { baseline: left, proposal: right, delta: null, bound: 'bothFull' }
+  if (leftFull && rightFull) return { baseline: left, proposal: right, delta: compareScalars(left.lastFundedYear, right.lastFundedYear).delta, bound: 'bothFull' }
   return {
     baseline: left,
     proposal: right,
```

Publish the difference of last funded years for two plans that both run their full horizons, the derivation's first proposal and the worksheet's third wrong reading: case D reads 3, only the gap between the two end years, where no difference is known and the field must be null (case C reads 0 for the same reason).

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/scenarios/planHeadlines.evidence.test.ts
```

## Captured failing output

Re-executed because the independent review's fixes (M1 to L3) moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (planHeadlines.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/scenarios/planHeadlines.evidence.test.ts (10 tests | 2 failed) 9ms
   ❯ plan-headline-longevity-comparison — Compare plans: how long the money lasts, deterministic success and depletion age (5)
     × cases A to F and H: last funded years, their difference and bound, success points and depletion ages 3ms
     × case D: two full plans on different horizons publish no difference, not the gap between their end years 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 8 passed (10)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/scenarios/planHeadlines.evidence.test.ts > plan-headline-longevity-comparison — Compare plans: how long the money lasts, deterministic success and depletion age > cases A to F and H: last funded years, their difference and bound, success points and depletion ages
AssertionError: caseC: expected +0 to be null // Object.is equality

- Expected:
null

+ Received:
0

 ❯ src/scenarios/planHeadlines.evidence.test.ts:238:48
    236|         const headline = comparePlanHeadlines(build(c.baseline), build…
    237|         expect([headline.moneyLasts.baseline.lastFundedYear, headline.…
    238|         expect(headline.moneyLasts.delta, key).toBe(e.delta)
       |                                                ^
    239|         expect(headline.moneyLasts.bound, key).toBe(e.bound)
    240|         expect(headline.deterministicSuccessPct.delta, key).toBe(e.suc…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/scenarios/planHeadlines.evidence.test.ts > plan-headline-longevity-comparison — Compare plans: how long the money lasts, deterministic success and depletion age > case D: two full plans on different horizons publish no difference, not the gap between their end years
AssertionError: expected 3 not to be 3 // Object.is equality
 ❯ src/scenarios/planHeadlines.evidence.test.ts:258:45
    256|       // the difference of last funded years, which is only the horizo…
    257|       expect(headline.moneyLasts.delta).not.toBe(0)
    258|       expect(headline.moneyLasts.delta).not.toBe(c.proposal.E - c.base…
       |                                             ^
    259|       expect(headline.moneyLasts.delta).toBeNull()
    260|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/moneyLasts.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/moneyLasts.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
