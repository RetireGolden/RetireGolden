# Mutation receipt: fedinvest-nearest-tips-maturity

Executed 2026-09-14 against RetireGolden base `319c16ca` (branch claude/b1-p4-cards-ladders) in `packages/engine`.

## Mutation applied to `packages/engine/src/ladder/fedInvest.ts`

```diff
@@ -104,7 +104,8 @@ export function nearestTipsForYear(tips: FedInvestTips[], year: number): FedInve
   let best: FedInvestTips | null = null
   let bestDistance = Number.POSITIVE_INFINITY
   for (const t of tips) {
-    const distance = Math.abs(Number(t.maturityIso.slice(0, 4)) - year)
+    const distance = year - Number(t.maturityIso.slice(0, 4))
+    if (distance < 0) continue
     if (distance < bestDistance) {
       best = t
       bestDistance = distance
```

This considers only maturities at or before the target year, the first wrong reading in the worksheet. The discriminating assertion is the boundary case (candidates 2031 and 2034 for target 2033): unmutated code returns the 2034 record (distance 1); the mutated code skips 2034, and 2031 at distance 2 falls outside production's one-year window, so it returns null instead of T2034. The worksheet's main example (2030 and 2035 for 2033) fails on the unmutated code too - it is the reported discrepancy (production returns null where the worksheet expects the 2035 record) - so that assertion cannot discriminate this mutation; the boundary case does.

## Command

```
npx vitest run src/ladder/fedInvest.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-b1p4impl/packages/engine
 ❯ src/ladder/fedInvest.evidence.test.ts (8 tests | 2 failed) 6ms
   ❯ fedinvest-nearest-tips-maturity — Nearest FedInvest TIPS for a rung year (3)
     × selects the 2035 TIPS for 2033: distance 2 beats distance 3 2ms
     × prefers a later maturity when it is nearer than the earlier one 0ms
 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-nearest-tips-maturity — Nearest FedInvest TIPS for a rung year > selects the 2035 TIPS for 2033: distance 2 beats distance 3
AssertionError: expected null to be 'T2035' // Object.is equality
- Expected:
"T2035"
+ Received:
null
 ❯ src/ladder/fedInvest.evidence.test.ts:112:57
    110|       // worksheet's value and fails until that discrepancy is settled.
    111|       const selected = nearestTipsForYear(candidates, targetYear)
    112|       expect(selected === null ? null : selected.cusip).toBe(example.e…
       |                                                         ^
    113|     })
    114|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  src/ladder/fedInvest.evidence.test.ts > fedinvest-nearest-tips-maturity — Nearest FedInvest TIPS for a rung year > prefers a later maturity when it is nearer than the earlier one
AssertionError: expected null to be 'T2034' // Object.is equality
- Expected:
"T2034"
+ Received:
null
 ❯ src/ladder/fedInvest.evidence.test.ts:128:57
    126|       ])
    127|       const selected = nearestTipsForYear(later, targetYear)
    128|       expect(selected === null ? null : selected.cusip).toBe('T2034')
       |                                                         ^
    129|     })
    130|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

`git checkout -- packages/engine/src/ladder/fedInvest.ts`, then `git diff --quiet -- packages/engine/src/ladder/fedInvest.ts` exited 0, confirming no change to production code after the run.
