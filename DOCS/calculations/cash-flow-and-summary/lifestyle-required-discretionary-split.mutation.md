# Mutation receipt: lifestyle-required-discretionary-split

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

Re-executed 2026-09-18 after the worksheet extension.

## Mutation applied to `packages/engine/src/spending/layers.ts`

```diff
diff --git a/packages/engine/src/spending/layers.ts b/packages/engine/src/spending/layers.ts
index 5cebc894..10e8fcb0 100644
--- a/packages/engine/src/spending/layers.ts
+++ b/packages/engine/src/spending/layers.ts
@@ -24,7 +24,7 @@ export interface LifestyleSplit {
  * sum back to `baseAnnualNominal` (the migrated fixed-target total).
  */
 export function splitLifestyle(baseAnnualNominal: number, requiredAnnualNominal: number): LifestyleSplit {
-  const requiredLifestyle = Math.min(Math.max(0, requiredAnnualNominal), Math.max(0, baseAnnualNominal))
+  const requiredLifestyle = Math.max(0, requiredAnnualNominal)
   return {
     requiredLifestyle,
     discretionaryLifestyle: Math.max(0, baseAnnualNominal - requiredLifestyle),
```

Omit the upper clamp so the required floor can exceed the lifestyle target.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 npx.cmd vitest run src/spending/layers.evidence.test.ts
```

## Captured failing output

The unmodified baseline passed (exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Mutation exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/spending/layers.evidence.test.ts (5 tests | 1 failed) 5ms
   ❯ lifestyle-required-discretionary-split — Lifestyle required discretionary split (1)
     × clamps a 70000 required floor to a 60000 target with zero discretionary dollars 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/spending/layers.evidence.test.ts > lifestyle-required-discretionary-split — Lifestyle required discretionary split > clamps a 70000 required floor to a 60000 target with zero discretionary dollars
AssertionError: requiredLifestyle: actual 70000, worksheet 60000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/spending/layers.evidence.test.ts:13:165
     11|     const actual = splitLifestyle(example.inputs.base as number, examp…
     12|     for (const key of ['requiredLifestyle', 'discretionaryLifestyle'] …
     13|       expect(withinTolerance(actual[key], example.expected[key] as num…
       |                                                                                                                                                                     ^
     14|     }
     15|   })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

Ran `git checkout -- packages/engine/src/spending/layers.ts`, then `git diff --quiet -- packages/engine/src/spending/layers.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite passed (exit 0). The baseline and restored suite are green; no discrepancy remains.
