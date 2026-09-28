# Mutation receipt: survival-probability-product

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) with the mutation restated on the curve's view, since survivalProbabilityTo became a view of survivalCurve in B2-P1 slice 4, and re-executed 2026-09-28 against RetireGolden base `b610eddc` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/survival.ts`

```diff
diff --git a/packages/engine/src/montecarlo/survival.ts b/packages/engine/src/montecarlo/survival.ts
index 1bc5e9f2..9dd0bf01 100644
--- a/packages/engine/src/montecarlo/survival.ts
+++ b/packages/engine/src/montecarlo/survival.ts
@@ -121,7 +121,7 @@ export function survivalProbabilityTo(
   // Not later (a NaN target included, as the empty product always was): 1.
   if (!(to > from)) return 1
   // An infinite target reads the product past the table's end, which is 0.
-  return runningSurvival(from, sex, hazard).survivalTo(Number.isFinite(to) ? to - from : MAX_AGE + 2)
+  return runningSurvival(from, sex, hazard).survivalTo(Number.isFinite(to) ? to - from + 1 : MAX_AGE + 2)
 }
 
 /**
```

This multiplies through the target age as well, the worksheet's first wrong reading (one period too many), now in the view survivalProbabilityTo takes of the survival curve: S(67) becomes p65 p66 p67 = 0.943802822411680, a 0.0193 miss against 1e-12, and the view no longer equals the retired product at any pair. The empty product at a target equal to the current age is returned before the view is read, so that assertion still passes; the percentile, joint and hazard blocks fail where they read survivalProbabilityTo.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/survival.evidence.test.ts
```

## Captured failing output

The slice's review fixes moved the lines around its hunk, renamed its module or changed its test file, so it is re-executed on the current code. The baseline is green (survival.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine13/packages/engine

 ❯ src/montecarlo/survival.evidence.test.ts (15 tests | 6 failed) 68ms
   ❯ survival-probability-product — Conditional survival to a target age: product of hazard-adjusted one-year survivals (5)
     × multiplies p65 and p66 from the SSA male rows: S(67) = 0.963150477964002 4ms
     × survivalProbabilityTo is the curve, bit for bit the product it computed before, at every integer pair and sex 59ms
   ❯ survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 (3)
     × brackets the threshold: S(66) >= 0.97 and S(67) < 0.97 0ms
   ❯ joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock (4)
     × single-life survival to 69, 70, 71 matches the worksheet within 1e-9 0ms
     × either-alive survival 1 - (1 - S)^2 qualifies at 70 (0.9905 >= 0.99) and fails at 71 (0.9856) 0ms
   ❯ survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection (3)
     × the adjusted expectancy at the solved power reproduces the 17.48 baseline 0ms

 Test Files  1 failed (1)
      Tests  6 failed | 9 passed (15)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-probability-product — Conditional survival to a target age: product of hazard-adjusted one-year survivals > multiplies p65 and p66 from the SSA male rows: S(67) = 0.963150477964002
AssertionError: survivalProbability 0.9438028224116805 is not within {"abs":1e-12} of the worksheet's 0.963150477964002: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:54:9
     52|         withinTolerance(survival, expected, example.tolerance),
     53|         `survivalProbability ${survival} is not within ${JSON.stringif…
     54|       ).toBe(true)
       |         ^
     55|     })
     56|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-probability-product — Conditional survival to a target age: product of hazard-adjusted one-year survivals > survivalProbabilityTo is the curve, bit for bit the product it computed before, at every integer pair and sex
AssertionError: expected { count: 21402, first: [ …(5) ] } to deeply equal { count: +0, first: [] }

- Expected
+ Received

  {
-   "count": 0,
-   "first": [],
+   "count": 21402,
+   "first": [
+     "male 0->1",
+     "male 0->2",
+     "male 0->3",
+     "male 0->4",
+     "male 0->5",
+   ],
  }

 ❯ src/montecarlo/survival.evidence.test.ts:97:75
     95|       }
     96|       // A count and the first few pairs, so a failure stays readable.
     97|       expect({ count: mismatches.length, first: mismatches.slice(0, 5)…
       |                                                                           ^
     98|     })
     99|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 > brackets the threshold: S(66) >= 0.97 and S(67) < 0.97
AssertionError: expected 0.9631504779640019 to be greater than or equal to 0.97
 ❯ src/montecarlo/survival.evidence.test.ts:125:66
    123|     it('brackets the threshold: S(66) >= 0.97 and S(67) < 0.97', () =>…
    124|       // The worksheet's two comparisons, through the product record's…
    125|       expect(survivalProbabilityTo(currentAge, sex, 66, hazard)).toBeG…
       |                                                                  ^
    126|       expect(survivalProbabilityTo(currentAge, sex, 67, hazard)).toBeL…
    127|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > single-life survival to 69, 70, 71 matches the worksheet within 1e-9
AssertionError: single-life survival to 69 0.9025074165078647 is not within {"abs":1e-9} of the worksheet's 0.923392932: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:175:11
    173|           withinTolerance(survival, expected, example.tolerance),
    174|           `single-life survival to ${age} ${survival} is not within ${…
    175|         ).toBe(true)
       |           ^
    176|       }
    177|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > either-alive survival 1 - (1 - S)^2 qualifies at 70 (0.9905 >= 0.99) and fails at 71 (0.9856)
AssertionError: either-alive survival to 69 0.990495196164029 is not within {"abs":1e-9} of the worksheet's 0.994131357: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:189:11
    187|           withinTolerance(eitherAlive, expected, example.tolerance),
    188|           `either-alive survival to ${age} ${eitherAlive} is not withi…
    189|         ).toBe(true)
       |           ^
    190|       }
    191|       expect(joint['70']!).toBeGreaterThanOrEqual(pct / 100)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier, solved by bisection > the adjusted expectancy at the solved power reproduces the 17.48 baseline
AssertionError: adjustedExpectancyYears 16.497929438989615 is not within {"abs":0.000001} of the worksheet's 17.48: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:249:9
    247|         withinTolerance(expectancy, expected, example.tolerance),
    248|         `adjustedExpectancyYears ${expectancy} is not within ${JSON.st…
    249|       ).toBe(true)
       |         ^
    250|     })
    251|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/survival.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
