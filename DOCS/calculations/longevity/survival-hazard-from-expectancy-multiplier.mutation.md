# Mutation receipt: survival-hazard-from-expectancy-multiplier

Executed 2026-09-14 against RetireGolden base `2dc2011c` (branch claude/b1-p4-cards-longevity), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet), and re-executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `2a93de55` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `476abd6e` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `b8927e7e` (branch `claude/life-table-2023`, pull request #759), and re-executed 2026-09-29 against RetireGolden base `df5da329` (branch `claude/people-order-and-scenarios`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/montecarlo/survival.ts`

```diff
diff --git a/packages/engine/src/montecarlo/survival.ts b/packages/engine/src/montecarlo/survival.ts
index 598b8cfa..e50d2494 100644
--- a/packages/engine/src/montecarlo/survival.ts
+++ b/packages/engine/src/montecarlo/survival.ts
@@ -275,7 +275,7 @@ function expectancyUnderHazard(age: number, sex: Sex, hazard: number): number {
  */
 export function hazardForExpectancyMultiplier(age: number, sex: Sex, m: number): number {
   if (!Number.isFinite(age)) throw new RangeError(`A hazard power is solved at a finite age; got ${age}`)
-  if (m === 1) return 1
+
   const target = Math.max(0.1, m) * expectancyUnderHazard(age, sex, 1)
   let lo = 0.2 // far healthier than the table
   let hi = 8 // far sicker than the table
```

This deletes the exact return at m = 1, so the identity point is bisected like any other multiplier. The bisection cannot land on 1: it returns a power within about 1e-12 of 1 but not 1, and the identity assertion, which compares with === 1 rather than a tolerance, fails at all 279 age and sex points; the pick at m = 1 does not move, since the power is that close. The non-identity case at m = 0.8 does not read the deleted line and still passes.

## Command

```
npx vitest run src/montecarlo/survival.evidence.test.ts
```

## Captured failing output

Re-executed because merging main moved the production lines or the evidence test lines this receipt quotes; the mutation is unchanged. The baseline is green (survival.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/montecarlo/survival.evidence.test.ts (23 tests | 1 failed) 157ms
   ❯ survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier: exactly 1 at m = 1, otherwise solved by bisection (5)
     × the identity multiplier m = 1 is exactly power 1 at all 279 age and sex points from 18 to 110 52ms

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/montecarlo/survival.evidence.test.ts > survival-hazard-from-expectancy-multiplier — Hazard power for a remaining-years multiplier: exactly 1 at m = 1, otherwise solved by bisection > the identity multiplier m = 1 is exactly power 1 at all 279 age and sex points from 18 to 110
AssertionError: expected { count: 279, first: [ …(5) ] } to deeply equal { count: +0, first: [] }

- Expected
+ Received

  {
-   "count": 0,
-   "first": [],
+   "count": 279,
+   "first": [
+     "male 18: 0.9999999999989995",
+     "male 19: 0.9999999999989995",
+     "male 20: 0.9999999999989995",
+     "male 21: 0.9999999999989995",
+     "male 22: 0.9999999999989995",
+   ],
  }

 ❯ src/montecarlo/survival.evidence.test.ts:316:67
    314|         }
    315|       }
    316|       expect({ count: misses.length, first: misses.slice(0, 5) }).toEq…
       |                                                                   ^
    317|     })
    318|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/montecarlo/survival.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/montecarlo/survival.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
