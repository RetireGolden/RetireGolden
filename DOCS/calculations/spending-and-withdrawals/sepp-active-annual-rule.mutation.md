# Mutation receipt: sepp-active-annual-rule

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/sepp.ts`

```diff
@@ -61,7 +61,7 @@ export const SEPP_AMORTIZATION_RATE_PCT = 5
  */
 export function seppActive(startAge: number, age: number): boolean {
   if (age < startAge) return false
-  return age < 60 || age - startAge < 5
+  return age - startAge < 5
 }
 
 /**
```

This drops the age boundary and keeps only the five-year duration, so a series begun at age 50 ends at 55 rather than running to the penalty boundary — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/sepp.evidence.test.ts
```

## Captured failing output

```
FAIL  src/strategies/sepp.evidence.test.ts > sepp-active-annual-rule — SEPP active in an attained-age year > keeps a series begun at 50 running past five years to the age boundary
AssertionError: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/strategies/sepp.ts`, then `git diff --quiet -- packages/engine/src/strategies/sepp.ts` exited 0, confirming no change to production code after the run.
