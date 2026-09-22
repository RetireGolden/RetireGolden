# Mutation receipt: inherited-account-final-deadline-year

Executed 2026-09-18 against RetireGolden base `60e47fd8` (branch claude/b1-p4-cards-slice-eleven) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/inheritedIra.ts`

```diff
@@ -913,7 +913,7 @@
       edb === 'minor-child' && b.beneficiaryBirthYear !== undefined
         ? {
             minorMajorityYear: b.beneficiaryBirthYear + 21,
-            finalDeadlineYear: b.beneficiaryBirthYear + 21 + 10,
+            finalDeadlineYear: deathYear + 10,
           }
         : {}
     return {
```

This gives the minor child a death-year-plus-ten deadline, publishing 2036 instead of 2041 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/inheritedIra.evidence.test.ts
```

## Captured failing output

```
 FAIL  src/strategies/inheritedIra.evidence.test.ts > inherited-account-final-deadline-year — Inherited-account final emptying year > reaches majority first for the minor child, then adds ten years
AssertionError: expected 2036 to be 2041 // Object.is equality
```

## Revert

`git checkout -- packages/engine/src/strategies/inheritedIra.ts`, then `git diff --quiet -- packages/engine/src/strategies/inheritedIra.ts` exited 0, confirming no change to production code after the run.
