# Mutation receipt: social-security-claim-age-sweep

Executed 2026-09-28 against RetireGolden base `34544677` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `edf7cdb1` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/openClaims.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/openClaims.ts b/packages/engine/src/socialSecurity/openClaims.ts
index 5e0369e4..653ed0a9 100644
--- a/packages/engine/src/socialSecurity/openClaims.ts
+++ b/packages/engine/src/socialSecurity/openClaims.ts
@@ -67,7 +67,7 @@ export function claimYearOf(person: Pick<Person, 'dob'>, claimAge: ClaimAgeValue
 
 /** The one test every claim-age search applies: the claim year is before the plan's start year. */
 export function isClaimAlreadyMade(person: Pick<Person, 'dob'>, claimAge: ClaimAgeValue, startYear: number): boolean {
-  return claimYearOf(person, claimAge) < startYear
+  return claimYearOf(person, claimAge) <= startYear
 }
 
 /**
```

This treats a claim in the start year as already made, the worksheet's third wrong reading: case S-G's 1964 birth claiming at 62 in 2026 reads as made, though that application can still be filed in the plan's first year.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/decisions/claimAgeSweep.evidence.test.ts
```

## Captured failing output

the slice 5 review fixes moved the production lines and test titles these receipts quote The baseline is green (claimAgeSweep.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/decisions/claimAgeSweep.evidence.test.ts (5 tests | 1 failed) 223ms
   ❯ social-security-claim-age-sweep — Whole-plan Social Security claim-age sweep (5)
     × S-G: a claim year before the start year is already made, and one in the start year is open 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/claimAgeSweep.evidence.test.ts > social-security-claim-age-sweep — Whole-plan Social Security claim-age sweep > S-G: a claim year before the start year is already made, and one in the start year is open
AssertionError: S-G 1964 at 62: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/decisions/claimAgeSweep.evidence.test.ts:120:80
    118|       for (const [label, dob, years, made] of cases) {
    119|         expect(claimYearOf({ dob }, { years, months: 0 }), label).toBe…
    120|         expect(isClaimAlreadyMade({ dob }, { years, months: 0 }, 2026)…
       |                                                                                ^
    121|       }
    122|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/openClaims.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/openClaims.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
