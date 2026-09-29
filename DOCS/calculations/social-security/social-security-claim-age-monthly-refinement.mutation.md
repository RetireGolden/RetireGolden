# Mutation receipt: social-security-claim-age-monthly-refinement

Executed 2026-09-28 against RetireGolden base `34544677` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `df5da329` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/claimAgeSweep.ts`

```diff
diff --git a/packages/engine/src/decisions/claimAgeSweep.ts b/packages/engine/src/decisions/claimAgeSweep.ts
index b88691cd..07b71b8b 100644
--- a/packages/engine/src/decisions/claimAgeSweep.ts
+++ b/packages/engine/src/decisions/claimAgeSweep.ts
@@ -371,4 +371,3 @@
           if (!row.eligible) {
             rejected.add(key)
-            continue
           }
```

This takes a month that ranks higher even when it breaks the objective's constraints, the worksheet's second wrong reading: case R-A's ineligible 68y5m (primary 130) replaces the whole-year pick, and the eligible 68y9m is never taken. Re-derived when the branch carried rule R7 (canonical order, passes to a fixed point, distinct months counted) into this search: the same reading on the rewritten line.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/claimAgeSweep.refine.evidence.test.ts
```

## Captured failing output

Re-derived when the branch merged main and carried rule R7 (D-PEOPLE-ORDER) into the engine's refinement: the same reading on the rewritten line. The baseline is green (claimAgeSweep.refine.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine19/packages/engine

 ❯ src/decisions/claimAgeSweep.refine.evidence.test.ts (2 tests | 1 failed) 12ms
   ❯ social-security-claim-age-monthly-refinement — Claim-age refinement to the month (2)
     × R-A: takes the best eligible month on the objective, not the highest estate, and counts the rejected one 5ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

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
