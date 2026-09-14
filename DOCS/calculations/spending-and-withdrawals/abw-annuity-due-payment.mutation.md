# Mutation receipt: abw-annuity-due-payment

Executed 2026-09-14 against RetireGolden base `fb398216` (branch grok/b1-p3c-catalog-scaffold) in `packages/engine`, and re-executed the same day on the round-1 fix pass over `c3799b55` (the fixture now names its inputs `realReturnPct`/`tiltPct` and asserts through `withinTolerance`), which is the output captured below.

## Mutation applied to `packages/engine/src/spending/abw.ts`

```diff
-  return (balance * (1 - x)) / (1 - Math.pow(x, n))
+  return (balance * (1 - x) * (1 + realReturnPct / 100)) / (1 - Math.pow(x, n))
```

This turns the beginning-of-period (annuity-due) payment into the end-of-period (ordinary annuity) payment: for B=210, r=10%, g=0, n=2 the closed form gives 121 instead of 110, the first wrong reading in the worksheet.

## Command

```
npx vitest run src/spending/abw.evidence.test.ts
```

## Captured failing output

```
 ❯ src/spending/abw.evidence.test.ts (1 test | 1 failed) 4ms
   ❯ abw-annuity-due-payment — Amortization-based withdrawal, growing annuity-due payment (1)
     × pays 110 now and 110 next period from 210 at 10% with no growth 4ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/spending/abw.evidence.test.ts > abw-annuity-due-payment — Amortization-based withdrawal, growing annuity-due payment > pays 110 now and 110 next period from 210 at 10% with no growth
AssertionError: payment 120.99999999999999 is not within {"abs":1e-9} of the worksheet's 110: expected false to be true // Object.is equality
 ❯ src/spending/abw.evidence.test.ts:32:9
     30|         withinTolerance(payment, expected, example.tolerance),
     31|         `payment ${payment} is not within ${JSON.stringify(example.tol…
     32|       ).toBe(true)
       |         ^
     33|     })
     34|   },
 Test Files  1 failed (1)
      Tests  1 failed (1)
```

The assertion compares the production payment with the worksheet's 110 through `withinTolerance` at an absolute tolerance of 1e-9; the mutated code pays 121 (the end-of-period reading) and misses by 11.

## Revert

`git checkout -- packages/engine/src/spending/abw.ts`, then `git diff --quiet -- packages/engine/src/spending/abw.ts` confirmed no change to production code after the run.
