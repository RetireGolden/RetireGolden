# Mutation receipt: social-security-claim-age-monthly-refinement

Executed 2026-09-28 against RetireGolden base `34544677` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `df5da329` (branch `claude/people-order-and-scenarios`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `8f562339` (branch `claude/people-order-and-scenarios`, pull request #765) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/claimAgeSweep.ts`

```diff
diff --git a/packages/engine/src/decisions/claimAgeSweep.ts b/packages/engine/src/decisions/claimAgeSweep.ts
index ac091401..1262fc08 100644
--- a/packages/engine/src/decisions/claimAgeSweep.ts
+++ b/packages/engine/src/decisions/claimAgeSweep.ts
@@ -393,4 +393,3 @@
         if (!row.eligible) {
           rejected.add(key)
-          continue
         }
```

This takes a month that ranks higher even when it breaks the objective's constraints, the worksheet's second wrong reading: case R-A's ineligible 68y5m (primary 130) replaces the whole-year pick, and the eligible 68y9m is never taken. Re-derived when round one of #765 (issue 4) removed the five-pass cap and moved each claim's window into claimMonthWindow, which re-indented this line: the same reading on the rewritten line.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/claimAgeSweep.refine.evidence.test.ts
```

## Captured failing output

Re-derived for the round-one review of #765 (issue 4): the same mutation on the line the removal of the pass cap re-indented. The baseline is green (claimAgeSweep.refine.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/decisions/claimAgeSweep.refine.evidence.test.ts (3 tests | 1 failed) 18ms
   ❯ social-security-claim-age-monthly-refinement — Claim-age refinement to the month (3)
     × R-A: takes the best eligible month on the objective, not the highest estate, and counts the rejected one 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/claimAgeSweep.refine.evidence.test.ts > social-security-claim-age-monthly-refinement — Claim-age refinement to the month > R-A: takes the best eligible month on the objective, not the highest estate, and counts the rejected one
AssertionError: expected { years: 68, months: 5 } to deeply equal { years: 68, months: 9 }

- Expected
+ Received

  {
-   "months": 9,
+   "months": 5,
    "years": 68,
  }

 ❯ src/decisions/claimAgeSweep.refine.evidence.test.ts:51:44
     49|         },
     50|       )
     51|       expect(search.claimByPersonId['p1']).toEqual({ years: expectedOf…
       |                                            ^
     52|       expect(search.row.primaryValue - winner.primaryValue).toBe(examp…
     53|       expect(search.row.endingAfterTaxEstate - winner.endingAfterTaxEs…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/claimAgeSweep.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/claimAgeSweep.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
