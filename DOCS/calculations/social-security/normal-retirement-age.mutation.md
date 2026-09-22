# Mutation receipt: normal-retirement-age

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/nra.ts`

```diff
@@ -38,7 +38,7 @@ export function fraForBirthYear(birthYearEffective: number): FraComponents {
   if (y === 1957) return { years: 66, extraMonths: 6 }
   if (y === 1958) return { years: 66, extraMonths: 8 }
   if (y === 1959) return { years: 66, extraMonths: 10 }
-  return { years: 67, extraMonths: 0 }
+  return { years: 66, extraMonths: 8 }
 }
 
 /** Total “month slots” from birth to reach FRA / claim age (approximation: 12y + extra). */
```

This assigns the post-ramp cohort the survivor cap of 66 years 8 months, or 800 month slots — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/nra.evidence.test.ts
```

## Captured failing output

```
FAIL  src/socialSecurity/nra.evidence.test.ts > normal-retirement-age — Normal retirement age endpoint > assigns 67 years and 0 months, or 804 month slots, past the end of the ramp
AssertionError: expected 66 to be 67 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/socialSecurity/nra.ts`, then `git diff --quiet -- packages/engine/src/socialSecurity/nra.ts` exited 0, confirming no change to production code after the run.
