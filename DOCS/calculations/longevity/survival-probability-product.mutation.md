# Mutation receipt: survival-probability-product

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) with the mutation restated on the curve's view, since survivalProbabilityTo became a view of survivalCurve in B2-P1 slice 4, and re-executed 2026-09-28 against RetireGolden base `2a93de55` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `476abd6e` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-29 against RetireGolden base `df5da329` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/survival.ts`

```diff
@@ -174,7 +174,7 @@
   // Not later (a NaN target included, as the empty product always was): 1.
   if (!(to > from)) return 1
   // An infinite target reads the product past the table's end, which is 0.
-  return runningSurvival(from, sex, hazard).survivalTo(Number.isFinite(to) ? to - from : MAX_AGE + 2)
+  return runningSurvival(from, sex, hazard).survivalTo(Number.isFinite(to) ? to - from + 1 : MAX_AGE + 2)
 }
 
 /**
```

This multiplies through the target age as well, the worksheet's first wrong reading (one period too many), in the view survivalProbabilityTo takes of the survival curve: S(67) becomes p65 p66 p67 = 0.948157295694515, a 0.0181 miss against 1e-12, and the view no longer equals the curve or the reference product at any pair. The empty product at a target equal to the current age is returned before the view is read, so that assertion still passes; the percentile and joint blocks fail where they read survivalProbabilityTo.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/montecarlo/survival.evidence.test.ts
```

## Captured failing output

Re-executed because merging main moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (survival.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/survival.evidence.test.ts (23 tests | 6 failed) 120ms
   ❯ survival-probability-product — The survival curve: product of hazard-adjusted one-year survivals, and the 50/50 mixture for 'average' (7)
     × multiplies p65 and p66 from SSA's published male q: S(67) = 0.983545 x 0.982426 = 0.96626018017 5ms
     × floors a fractional target, reads the curve at whole years only, and gives 1 for dying once nobody is alive 0ms
     × survivalProbabilityTo is the curve, bit for bit the product for a man or a woman and the mean of the two for 'average', at every integer pair 109ms
   ❯ survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 (5)
     × brackets the threshold: S(66) >= 0.97 and S(67) < 0.97 0ms
   ❯ joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock (6)
     × single-life survival to 69, 70, 71 matches the worksheet within 1e-9 0ms
     × either-alive survival 1 - (1 - S)^2 qualifies at 70 (0.9918 >= 0.99) and fails at 71 (0.9876) 0ms

 Test Files  1 failed (1)
      Tests  6 failed | 17 passed (23)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 6 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-probability-product — The survival curve: product of hazard-adjusted one-year survivals, and the 50/50 mixture for 'average' > multiplies p65 and p66 from SSA's published male q: S(67) = 0.983545 x 0.982426 = 0.96626018017
AssertionError: survivalProbability 0.9481572956945151 is not within {"abs":1e-12} of the worksheet's 0.96626018017: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:73:9
     71|         withinTolerance(survival, expected, example.tolerance),
     72|         `survivalProbability ${survival} is not within ${JSON.stringif…
     73|       ).toBe(true)
       |         ^
     74|     })
     75|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-probability-product — The survival curve: product of hazard-adjusted one-year survivals, and the 50/50 mixture for 'average' > floors a fractional target, reads the curve at whole years only, and gives 1 for dying once nobody is alive
AssertionError: expected 0.9481572956945151 to be 0.96626018017 // Object.is equality

- Expected
+ Received

- 0.96626018017
+ 0.9481572956945151

 ❯ src/montecarlo/survival.evidence.test.ts:112:55
    110|
    111|     it('floors a fractional target, reads the curve at whole years onl…
    112|       expect(survivalProbabilityTo(65, 'male', 67.9)).toBe(curveValue(…
       |                                                       ^
    113|       expect(survivalProbabilityTo(65, 'male', 67.9)).toBe(survivalPro…
    114|       expect(() => survivalCurve(65, 'male').survivalTo(1.5)).toThrow(…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-probability-product — The survival curve: product of hazard-adjusted one-year survivals, and the 50/50 mixture for 'average' > survivalProbabilityTo is the curve, bit for bit the product for a man or a woman and the mean of the two for 'average', at every integer pair
AssertionError: expected { count: 21420, first: [ …(5) ] } to deeply equal { count: +0, first: [] }

- Expected
+ Received

  {
-   "count": 0,
-   "first": [],
+   "count": 21420,
+   "first": [
+     "male 0->1",
+     "male 0->2",
+     "male 0->3",
+     "male 0->4",
+     "male 0->5",
+   ],
  }

 ❯ src/montecarlo/survival.evidence.test.ts:146:75
    144|       }
    145|       // A count and the first few pairs, so a failure stays readable.
    146|       expect({ count: mismatches.length, first: mismatches.slice(0, 5)…
       |                                                                           ^
    147|     })
    148|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-percentile-age — Survival-percentile planning age: oldest age reached with probability at least pct/100 > brackets the threshold: S(66) >= 0.97 and S(67) < 0.97
AssertionError: expected 0.96626018017 to be greater than or equal to 0.97
 ❯ src/montecarlo/survival.evidence.test.ts:177:66
    175|     it('brackets the threshold: S(66) >= 0.97 and S(67) < 0.97', () =>…
    176|       // The worksheet's two comparisons, through the product record's…
    177|       expect(survivalProbabilityTo(currentAge, sex, 66, hazard)).toBeG…
       |                                                                  ^
    178|       expect(survivalProbabilityTo(currentAge, sex, 67, hazard)).toBeL…
    179|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > single-life survival to 69, 70, 71 matches the worksheet within 1e-9
AssertionError: single-life survival to 69 0.9093586176567833 is not within {"abs":1e-9} of the worksheet's 0.929212164769243: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:241:11
    239|           withinTolerance(survival, expected, example.tolerance),
    240|           `single-life survival to ${age} ${survival} is not within ${…
    241|         ).toBe(true)
       |           ^
    242|       }
    243|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/6]⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > joint-survival-percentile-age — Joint (either-survives) percentile age on the primary's age clock > either-alive survival 1 - (1 - S)^2 qualifies at 70 (0.9918 >= 0.99) and fails at 71 (0.9876)
AssertionError: either-alive survival to 69 0.9917841398069108 is not within {"abs":1e-9} of the worksheet's 0.9949890823833432: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/montecarlo/survival.evidence.test.ts:256:11
    254|           withinTolerance(eitherAlive, expected, example.tolerance),
    255|           `either-alive survival to ${age} ${eitherAlive} is not withi…
    256|         ).toBe(true)
       |           ^
    257|       }
    258|       expect(joint['70']!).toBeGreaterThanOrEqual(pct / 100)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/6]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/survival.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
