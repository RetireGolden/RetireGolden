# Mutation receipt: social-security-claim-already-made

Executed 2026-09-28 against RetireGolden base `f4dc10f3` (branch `claude/b2p1-slice5-sweeps`; no pull request is open yet) in `packages/engine`.

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

This counts a claim in the start year as already made, the worksheet's first wrong reading: case S-B's 1964-11-30 birth claiming at 62 in 2026 and case S-C's claim at 62y6m in 2026 read as made, though either application can still be filed in the plan's first year, and S-D's claim at 64 in 2026 would no longer be offered.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/openClaims.evidence.test.ts
```

## Captured failing output

The baseline is green (openClaims.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine16/packages/engine

 ❯ src/socialSecurity/openClaims.evidence.test.ts (2 tests | 1 failed) 13ms
   ❯ social-security-claim-already-made — Social Security claim already made (2)
     × S-A to S-D: made exactly when the birth year plus the claim years is before the start year 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/openClaims.evidence.test.ts > social-security-claim-already-made — Social Security claim already made > S-A to S-D: made exactly when the birth year plus the claim years is before the start year
AssertionError: S-B 1964-11-30 at 62: expected true to be false // Object.is equality

- Expected
+ Received

- false
+ true

 ❯ src/socialSecurity/openClaims.evidence.test.ts:67:73
     65|       for (const [label, dob, claimAge, startYear] of cases) {
     66|         expect(claimYearOf({ dob }, claimAge), label).toBe(yearOf(labe…
     67|         expect(isClaimAlreadyMade({ dob }, claimAge, startYear), label…
       |                                                                         ^
     68|       }
     69|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/openClaims.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/openClaims.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
