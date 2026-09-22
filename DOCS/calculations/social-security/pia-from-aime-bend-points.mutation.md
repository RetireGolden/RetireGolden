# Mutation receipt: pia-from-aime-bend-points

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/piaFromEarnings.ts`

```diff
@@ -106,7 +106,7 @@ export function piaMonthlyFromAime(aime: number, eligibilityYear: number): numbe
   let pia =
     0.9 * Math.min(aime, b1) +
     0.32 * Math.max(0, Math.min(aime, b2) - b1) +
-    0.15 * Math.max(0, aime - b2)
+    0.32 * Math.max(0, aime - b2)
   pia = floorToDime(pia)
   return pia
 }
```

This applies 32% rather than 15% to AIME above the second bend point, giving $3,625.88 before the dime floor — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/piaFromEarnings.evidence.test.ts
```

## Captured failing output

```
FAIL  src/socialSecurity/piaFromEarnings.evidence.test.ts > pia-from-aime-bend-points — PIA from AIME across the bend points > applies 90/32/15 across the 2026 bend points for a 3,413.20 PIA
AssertionError: crossBoth 3625.8 is not within {"abs":0.05} of the worksheet's 3413.2: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/socialSecurity/piaFromEarnings.ts`, then `git diff --quiet -- packages/engine/src/socialSecurity/piaFromEarnings.ts` exited 0, confirming no change to production code after the run.
