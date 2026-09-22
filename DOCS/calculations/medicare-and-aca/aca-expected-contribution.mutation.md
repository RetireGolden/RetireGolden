# Mutation receipt: aca-expected-contribution

Executed 2026-09-18 against RetireGolden base `989fc81b` (branch claude/b1-p4-cards-slice-eight) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/aca.ts`

```diff
@@ -123,7 +123,7 @@ export function acaFederalPovertyLine(
 ): number {
   const table = pack.federalPovertyLine[region]
   return (
-    (table.firstPerson + table.perAdditionalPerson * Math.max(0, householdSize - 1)) *
+    (table.firstPerson + table.perAdditionalPerson * 0) *
     fplScale
   )
 }
```

This counts only the first person in the poverty line, so a two-person household is measured against $15,650 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/aca.evidence.test.ts
```

## Captured failing output

```
FAIL  src/tax/aca.evidence.test.ts > aca-expected-contribution — ACA expected contribution > builds a 21,150 poverty line for two people and contributes 6.60% of 42,300
AssertionError: expected 15650 to be 21150 // Object.is equality

FAIL  src/tax/aca.evidence.test.ts > aca-expected-contribution — ACA expected contribution > counts every household member in the poverty line, not just the first
AssertionError: expected 15650 to be greater than 15650
```

## Revert

`git checkout -- packages/engine/src/tax/aca.ts`, then `git diff --quiet -- packages/engine/src/tax/aca.ts` exited 0, confirming no change to production code after the run.
