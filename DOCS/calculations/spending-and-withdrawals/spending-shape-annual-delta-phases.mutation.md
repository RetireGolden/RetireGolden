# Mutation receipt: spending-shape-annual-delta-phases

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/spending/shapePresets.ts`

```diff
@@ -50,7 +50,7 @@ export function annualDeltaPhases(deltaPct: number, retirementAge: number): Expe
   const startAge = Math.min(Math.max(Math.round(retirementAge), 40), 105)
   const phases: ExpensePhase[] = []
   for (let age = startAge + STEP_YEARS; age <= LAST_STEP_AGE; age += STEP_YEARS) {
-    const multiplier = Math.pow(1 + deltaPct / 100, age - startAge)
+    const multiplier = 1 + (deltaPct / 100) * (age - startAge)
     phases.push({ fromAge: age, multiplier: Math.min(3, Math.max(0, Math.round(multiplier * 100) / 100)) })
   }
   return phases
```

This replaces compounding with a linear decline, the worksheet's first wrong reading: the age-70 row still rounds to 0.90, but the age-75 row becomes 0.80 instead of 0.82, a 0.02 miss against the absolute bound of 0. The step-age, two-decimal and zero-delta assertions still pass; the preset block's smirk rows also survive, because at -1%/yr the linear and compounded multipliers round to the same 0.95 and 0.90 at 70 and 75.

## Command

```
npx vitest run src/spending/shapePresets.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/spending/shapePresets.evidence.test.ts (7 tests | 1 failed) 6ms
   ❯ spending-shape-annual-delta-phases — Annual real spending drift compiled to five-year phase rows (3)
     × compiles -2%/yr from 65 into (70, 0.90) and (75, 0.82) as its first two rows 4ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/spending/shapePresets.evidence.test.ts > spending-shape-annual-delta-phases — Annual real spending drift compiled to five-year phase rows > compiles -2%/yr from 65 into (70, 0.90) and (75, 0.82) as its first two rows
AssertionError: row 1 multiplier 0.8 is not within {"abs":0} of the worksheet's 0.82: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/spending/shapePresets.evidence.test.ts:14:7
     12|       withinTolerance(actual[index]!.multiplier, row.multiplier, toler…
     13|       `row ${index} multiplier ${actual[index]!.multiplier} is not wit…
     14|     ).toBe(true)
       |       ^
     15|   })
     16| }
 ❯ expectFirstRows src/spending/shapePresets.evidence.test.ts:9:12
 ❯ src/spending/shapePresets.evidence.test.ts:44:7
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

## Revert

`git checkout -- packages/engine/src/spending/shapePresets.ts`, then `git diff --quiet -- packages/engine/src/spending/shapePresets.ts` exited 0, confirming no change to production code after the run.
