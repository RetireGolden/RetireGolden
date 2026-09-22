# Mutation receipt: family-maximum-bend-points

Executed 2026-09-18 against RetireGolden base `39f8f460` (branch claude/b1-p4-cards-slice-nine) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/familyMaximum.ts`

```diff
@@ -37,7 +37,7 @@ export function familyMaximumMonthlyFromPia(piaMonthly: number, eligibilityYear:
   const second = Math.max(0, Math.min(piaMonthly, bp.second) - bp.first)
   const third = Math.max(0, Math.min(piaMonthly, bp.third) - bp.second)
   const above = Math.max(0, piaMonthly - bp.third)
-  return floorToDime(first * 1.5 + second * 2.72 + third * 1.34 + above * 1.75)
+  return floorToDime(first * 1.5 + second * 2.72 + third * 1.34)
 }
```

This drops the 175% band above the third bend point, publishing $5,412.10 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/familyMaximum.evidence.test.ts
```

## Captured failing output

```
FAIL  src/socialSecurity/familyMaximum.evidence.test.ts > family-maximum-bend-points — Retirement/survivor family maximum from PIA > crosses all three bend points to a dime-floored 6999.30
AssertionError: family maximum 5412.1 is not within {"abs":0} of the worksheet's 6999.3: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/socialSecurity/familyMaximum.ts`, then `git diff --quiet -- packages/engine/src/socialSecurity/familyMaximum.ts` exited 0, confirming no change to production code after the run.
