# Mutation receipt: rmd-applicable-age-attain-year

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

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

```
FAIL  src/rmd/applicableAge.evidence.test.ts > rmd-applicable-age-attain-year — RMD applicable age and attain year > derives a required beginning date in calendar 2029, so a 2028 death is before it
AssertionError: expected 'resolved' to be 'needs-review' // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/rmd/applicableAge.ts`, then `git diff --quiet -- packages/engine/src/rmd/applicableAge.ts` exited 0, confirming no change to production code after the run.
