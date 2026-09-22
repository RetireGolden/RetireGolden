# Mutation receipt: qcd-limit-and-age-proxy

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

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

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualLegacyQcdGiftPlan.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualLegacyQcdGiftPlan.evidence.test.ts (4 tests | 1 failed) 6ms
   ❯ qcd-limit-and-age-proxy — QCD per-donor limit and age-70.5 annual proxy (4)
     × refuses an attained-70 donor born in July under the same proxy 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualLegacyQcdGiftPlan.evidence.test.ts > qcd-limit-and-age-proxy — QCD per-donor limit and age-70.5 annual proxy > refuses an attained-70 donor born in July under the same proxy
AssertionError: qcd on the ineligible side 1000 is not within {"abs":0.005} of the worksheet's 0: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/projection/internal/annualLegacyQcdGiftPlan.evidence.test.ts:21:5
     19|     withinTolerance(actual, expected, tolerance),
     20|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     21|   ).toBe(true)
       |     ^
     22| }
     23|
 ❯ src/projection/internal/annualLegacyQcdGiftPlan.evidence.test.ts:88:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualLegacyQcdGiftPlan.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
