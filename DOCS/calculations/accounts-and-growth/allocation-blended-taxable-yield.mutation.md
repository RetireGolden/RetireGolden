# Mutation receipt: allocation-blended-taxable-yield

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/allocation/assetClasses.ts`

```diff
@@ -189,7 +189,7 @@ export function blendedTaxableYield(
   return {
     interestYieldPct: interest,
     dividendYieldPct: dividends,
-    qualifiedRatio: dividends > 0 ? qualified / dividends : DEFAULT_QUALIFIED_DIVIDEND_RATIO,
+    qualifiedRatio: dividends > 0 ? qualified : DEFAULT_QUALIFIED_DIVIDEND_RATIO,
   }
 }
 
```

This drops the division by the blended dividend yield, so the qualified share is the qualified dividend yield itself (0.855) rather than the dividend-dollar-weighted ratio 0.95, a 0.095 miss against the 1e-12 tolerance. The interest and dividend yields are untouched, so only the ratio assertion fails; the zero-dividend fallback still passes.

## Command

```
npx vitest run src/allocation/assetClasses.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/allocation/assetClasses.evidence.test.ts (32 tests | 1 failed) 9ms
   ❯ allocation-blended-taxable-yield — Blended taxable yields and dividend-weighted qualified share (3)
     × blends 60/40 to 1.6% interest, 0.9% dividends and a 0.95 dividend-weighted qualified share 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-blended-taxable-yield — Blended taxable yields and dividend-weighted qualified share > blends 60/40 to 1.6% interest, 0.9% dividends and a 0.95 dividend-weighted qualified share
AssertionError: qualifiedRatio 0.8549999999999999 is not within {"abs":1e-12} of the worksheet's 0.95: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:416:11
    414|           withinTolerance(blend[field], expected, example.tolerance),
    415|           `${field} ${blend[field]} is not within ${JSON.stringify(exa…
    416|         ).toBe(true)
       |           ^
    417|       }
    418|     })
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 31 passed (32)
```

## Revert

`git checkout -- packages/engine/src/allocation/assetClasses.ts`, then `git diff --quiet -- packages/engine/src/allocation/assetClasses.ts` exited 0, confirming no change to production code after the run.
