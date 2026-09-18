# Mutation receipt: lifestyle-required-discretionary-split

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch `codex/b1-p4-cards-cashflow-optimizer-taxes`) in `packages/engine`.

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
npx.cmd vitest run src/spending/layers.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/Users/Nathan/source/repos/RetireGolden/.worktrees/slice4-20260917/packages/engine

 ❯ src/spending/layers.evidence.test.ts (4 tests | 2 failed) 6ms
   ❯ lifestyle-required-discretionary-split — Lifestyle required discretionary split (1)
     × clamps a 70000 required floor to a 60000 target with zero discretionary dollars 4ms
   ❯ spending-layer-shortfall-attribution — Spending layer shortfall attribution (3)
     × attributes worksheet target shortfall 15 (production discrepancy remains visible) 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

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

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/spending/layers.evidence.test.ts > spending-layer-shortfall-attribution — Spending layer shortfall attribution > attributes worksheet target shortfall 15 (production discrepancy remains visible)
AssertionError: targetShortfall: actual 20, worksheet 15: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/spending/layers.evidence.test.ts:35:184
     33|   it('attributes worksheet target shortfall 15 (production discrepancy…
     34|     const actual = attributeShortfall(example.inputs as unknown as Sho…
     35|     expect(withinTolerance(actual, example.expected.targetShortfall as…
       |                                                                                                                                                                                        ^
     36|   })
     37|   it('attributes ideal and excess shortfalls 20 and 10', () => {

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

Restored the exact original production bytes in a `finally` block, then `git diff --quiet -- packages/engine/src/spending/layers.ts` exited 0, confirming no production change remained. Re-ran the named command after restoration. The restored named file exits 1 solely for the preserved worksheet discrepancy: targetShortfall actual 20 versus worksheet 15. Captured restored failure: AssertionError: targetShortfall: actual 20, worksheet 15: expected false to be true // Object.is equality
