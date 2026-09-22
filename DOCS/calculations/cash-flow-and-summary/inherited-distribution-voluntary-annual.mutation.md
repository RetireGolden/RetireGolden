# Mutation receipt: inherited-distribution-voluntary-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eleven` at base `60e47fd8`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualWithdrawalApplyFlowPlan.ts`

```diff
@@ -84,7 +84,7 @@
       evidenceAccount !== undefined &&
       (evidenceAccount.type === 'traditional' ||
         evidenceAccount.type === 'roth') &&
-      isTreatAsOwnEffective(evidenceAccount, input.year, input.ownerTreatmentRouting)
+      false
     ) continue
     evidenceWrites.push({
       evidenceIndex,
```

This ignores the treat-as-own routing, so an account under owner treatment still receives an inherited voluntary evidence write — the worksheet's third wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualWithdrawalApplyFlowPlan.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualWithdrawalApplyFlowPlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualWithdrawalApplyFlowPlan.evidence.test.ts (2 tests | 1 failed) 6ms
   ❯ inherited-distribution-voluntary-annual — Voluntary inherited-account draw (2)
     × writes no inherited voluntary row at all once treat-as-own is effective 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualWithdrawalApplyFlowPlan.evidence.test.ts > inherited-distribution-voluntary-annual — Voluntary inherited-account draw > writes no inherited voluntary row at all once treat-as-own is effective
AssertionError: expected [ { evidenceIndex: +0, …(2) } ] to deeply equal []

- Expected
+ Received

- []
+ [
+   {
+     "accountId": "inherited-ira",
+     "evidenceIndex": 0,
+     "voluntaryAmount": 12000,
+   },
+ ]

 ❯ src/projection/internal/annualWithdrawalApplyFlowPlan.evidence.test.ts:105:37
    103|     it('writes no inherited voluntary row at all once treat-as-own is …
    104|       const result = plan(true)
    105|       expect(result.evidenceWrites).toEqual([])
       |                                     ^
    106|       // The withdrawal still happens; it is simply not inherited-clas…
    107|       expect(result.balanceOperations[0]?.taken).toBe(planDraw)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualWithdrawalApplyFlowPlan.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualWithdrawalApplyFlowPlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
