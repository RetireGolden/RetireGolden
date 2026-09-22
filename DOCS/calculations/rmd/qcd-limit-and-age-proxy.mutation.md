# Mutation receipt: qcd-limit-and-age-proxy

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts`

```diff
@@ -90,7 +90,7 @@ export function annualLegacyQcdGiftPlan(
   const donorIds = new Set(input.people
     .filter((person) => person.alive && (
       person.ageAttained >= 71 ||
-      (person.ageAttained === 70 && person.birthMonth <= 6)
+      (person.ageAttained === 70)
     ))
     .map((person) => person.personId))
   if (donorIds.size === 0) return emptyResult()
```

This admits every attained-age-70 donor regardless of birth month, so the July-born donor gives $1,000 where the annual 70.5 proxy allows nothing — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualLegacyQcdGiftPlan.evidence.test.ts
```

## Captured failing output

```
FAIL  src/projection/internal/annualLegacyQcdGiftPlan.evidence.test.ts > qcd-limit-and-age-proxy — QCD per-donor limit and age-70.5 annual proxy > refuses an attained-70 donor born in July under the same proxy
AssertionError: qcd on the ineligible side 1000 is not within {"abs":0.005} of the worksheet's 0: expected false to be true // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts`, then `git diff --quiet -- packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts` exited 0, confirming no change to production code after the run.
