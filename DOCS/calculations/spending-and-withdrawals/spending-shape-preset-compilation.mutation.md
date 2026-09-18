# Mutation receipt: spending-shape-preset-compilation

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/spending/shapePresets.ts`

```diff
@@ -67,7 +67,7 @@ export function spendingShapePhases(shape: SpendingShapeId, retirementAge: numbe
         { fromAge: 85, multiplier: 0.8 },
       ]
     case 'smirk':
-      return annualDeltaPhases(SMIRK_ANNUAL_REAL_DELTA_PCT, retirementAge)
+      return annualDeltaPhases(SMIRK_ANNUAL_REAL_DELTA_PCT - 2.5, retirementAge)
     case 'frontLoaded': {
       const boostFrom = Math.min(Math.max(retirementAge, 40), 100)
       // The +10% travel boost only covers the pre-75 window and always settles
```

This subtracts an inflation-like 2.5 points from the smirk delta a second time, the worksheet's first wrong reading (a nominal decline treated as real): the first row becomes 0.965^5 rounded, 0.84, instead of 0.95, a 0.11 miss against the absolute bound of 0. The delegation assertion fails with it, every row differing from annualDeltaPhases(-1, 65); flat and the smirk constant are untouched.

## Command

```
npx vitest run src/spending/shapePresets.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/spending/shapePresets.evidence.test.ts (7 tests | 2 failed) 7ms
   ❯ spending-shape-preset-compilation — Named spending shapes compiled to phase rows (4)
     × compiles smirk from 65 into (70, 0.95) and (75, 0.90) as its first rows 3ms
     × smirk delegates to the annual-delta compilation at -1%/yr 2ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/spending/shapePresets.evidence.test.ts > spending-shape-preset-compilation — Named spending shapes compiled to phase rows > compiles smirk from 65 into (70, 0.95) and (75, 0.90) as its first rows
AssertionError: row 0 multiplier 0.84 is not within {"abs":0} of the worksheet's 0.95: expected false to be true // Object.is equality
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
 ❯ src/spending/shapePresets.evidence.test.ts:89:7
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  src/spending/shapePresets.evidence.test.ts > spending-shape-preset-compilation — Named spending shapes compiled to phase rows > smirk delegates to the annual-delta compilation at -1%/yr
AssertionError: expected [ …(7) ] to deeply equal [ …(7) ]
- Expected
+ Received
  [
    {
      "fromAge": 70,
-     "multiplier": 0.95,
+     "multiplier": 0.84,
    },
    {
      "fromAge": 75,
-     "multiplier": 0.9,
+     "multiplier": 0.7,
    },
    {
      "fromAge": 80,
-     "multiplier": 0.86,
+     "multiplier": 0.59,
    },
    {
      "fromAge": 85,
-     "multiplier": 0.82,
+     "multiplier": 0.49,
    },
    {
      "fromAge": 90,
-     "multiplier": 0.78,
+     "multiplier": 0.41,
    },
    {
      "fromAge": 95,
-     "multiplier": 0.74,
+     "multiplier": 0.34,
    },
    {
      "fromAge": 100,
-     "multiplier": 0.7,
+     "multiplier": 0.29,
    },
  ]
 ❯ src/spending/shapePresets.evidence.test.ts:97:21
     95|
     96|     it('smirk delegates to the annual-delta compilation at -1%/yr', ()…
     97|       expect(smirk).toEqual(annualDeltaPhases(SMIRK_ANNUAL_REAL_DELTA_…
       |                     ^
     98|     })
     99|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)
```

## Revert

`git checkout -- packages/engine/src/spending/shapePresets.ts`, then `git diff --quiet -- packages/engine/src/spending/shapePresets.ts` exited 0, confirming no change to production code after the run.
