# Mutation receipt: rmd-applicable-age-attain-year

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/rmd/applicableAge.ts`

```diff
@@ -86,7 +86,7 @@ function applicableAgesForDate(
     return { ages: [72], isSeventyAndHalf: false, fromBorn1959Contested: false }
   }
   if (birthYear <= 1958) {
-    return { ages: [73], isSeventyAndHalf: false, fromBorn1959Contested: false }
+    return { ages: [72], isSeventyAndHalf: false, fromBorn1959Contested: false }
   }
   // Born 1959: contested between 73 and 75 — never collapse to a single age.
   if (birthYear === 1959) {
@@ -117,7 +117,7 @@ export function applicableAgeAttainYears(
   if (ownerBirthYear >= 1960) {
     return [ownerBirthYear + 75]
   }
   if (ownerBirthYear >= 1951) {
-    return [ownerBirthYear + 73]
+    return [ownerBirthYear + 72]
   }
```

This puts the settled 1951-1958 cohort on applicable age 72 in both helpers, the RBD derivation and the attain-year helper (which hardcodes the cohort's age separately), moving the attain year to 2027 and the required beginning date into 2028, so a 2028 death is no longer unambiguously before the RBD — the worksheet's first wrong reading. A mutation of the RBD helper alone left the attain-year assertion green and only tripped the contradictory-assertion arm; the second hunk is what makes the attain-year claim executed evidence.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/rmd/applicableAge.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (applicableAge.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/rmd/applicableAge.evidence.test.ts (4 tests | 2 failed) 7ms
   ❯ rmd-applicable-age-attain-year — RMD applicable age and attain year (4)
     × places a 1955 birth in the settled age-73 cohort attaining that age in 2028 4ms
     × derives a required beginning date in calendar 2029, so a 2028 death is before it 1ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/rmd/applicableAge.evidence.test.ts > rmd-applicable-age-attain-year — RMD applicable age and attain year > places a 1955 birth in the settled age-73 cohort attaining that age in 2028
AssertionError: attainYears[0] 2027 is not within "exact" of the worksheet's 2028: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/rmd/applicableAge.evidence.test.ts:16:5
     14|     withinTolerance(actual, expected, tolerance),
     15|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     16|   ).toBe(true)
       |     ^
     17| }
     18|
 ❯ src/rmd/applicableAge.evidence.test.ts:40:9
 ❯ src/rmd/applicableAge.evidence.test.ts:39:19

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/rmd/applicableAge.evidence.test.ts > rmd-applicable-age-attain-year — RMD applicable age and attain year > derives a required beginning date in calendar 2029, so a 2028 death is before it
AssertionError: expected 'resolved' to be 'needs-review' // Object.is equality

Expected: "needs-review"
Received: "resolved"

 ❯ src/rmd/applicableAge.evidence.test.ts:60:33
     58|         ownerBirthYear: inputs.ownerBirthYear!,
     59|       })
     60|       expect(contradicted.kind).toBe('needs-review')
       |                                 ^
     61|     })
     62|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/rmd/applicableAge.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/rmd/applicableAge.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
