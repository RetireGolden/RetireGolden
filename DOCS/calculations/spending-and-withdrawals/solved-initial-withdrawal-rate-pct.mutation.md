# Mutation receipt: solved-initial-withdrawal-rate

Executed 2026-09-27 against RetireGolden base `fe28be3c` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `2c35d2b8` (branch `claude/b2p1-slice2-display-math`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/spendingSolver.ts`

```diff
diff --git a/packages/engine/src/decisions/spendingSolver.ts b/packages/engine/src/decisions/spendingSolver.ts
index 6d174d4d..b75577ba 100644
--- a/packages/engine/src/decisions/spendingSolver.ts
+++ b/packages/engine/src/decisions/spendingSolver.ts
@@ -239,5 +239,5 @@
     )
   }
-  return startingInvestable > 0 ? (annualSpend / startingInvestable) * 100 : null
+  return startingInvestable > 0 ? (annualSpend * 100) / startingInvestable : null
 }
 
```

Multiplies before dividing, the worksheet's other association: case A becomes 4.1866666666666665, one unit in the last place below the published 4.186666666666667, although both print 4.19.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/spendingSolver.withdrawalRate.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 after the independent review of B2-P1 slice 2 changed this receipt's evidence file or moved the lines it mutates, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (spendingSolver.withdrawalRate.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine8/packages/engine

 ❯ src/decisions/spendingSolver.withdrawalRate.evidence.test.ts (4 tests | 2 failed) 56ms
   ❯ solved-initial-withdrawal-rate — Solved spending as an initial withdrawal rate (4)
     × cases A to F: (annual spend / starting investable) × 100, in that association, to the bit 4ms
     × rejects the other association, one unit in the last place off in case A 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/spendingSolver.withdrawalRate.evidence.test.ts > solved-initial-withdrawal-rate — Solved spending as an initial withdrawal rate > cases A to F: (annual spend / starting investable) × 100, in that association, to the bit
AssertionError: caseA: 4.1866666666666665: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/spendingSolver.withdrawalRate.evidence.test.ts:54:119
     52|         const c = inputs[key]!
     53|         const rate = initialWithdrawalRatePct(c.maxBaseAnnual, c.start…
     54|         expect(rate !== null && withinTolerance(rate, expected[key] as…
       |                                                                                                                       ^
     55|         expect(rate!.toFixed(2)).toBe((expected.printed as Record<stri…
     56|       }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/decisions/spendingSolver.withdrawalRate.evidence.test.ts > solved-initial-withdrawal-rate — Solved spending as an initial withdrawal rate > rejects the other association, one unit in the last place off in case A
AssertionError: expected 4.1866666666666665 not to be 4.1866666666666665 // Object.is equality
 ❯ src/decisions/spendingSolver.withdrawalRate.evidence.test.ts:69:83
     67|       const c = inputs.caseA!
     68|       expect((c.maxBaseAnnual * 100) / c.startingInvestable).toBe(expe…
     69|       expect(initialWithdrawalRatePct(c.maxBaseAnnual, c.startingInves…
       |                                                                                   ^
     70|     })
     71|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/spendingSolver.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/spendingSolver.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
