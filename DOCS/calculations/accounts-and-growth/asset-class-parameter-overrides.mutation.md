# Mutation receipt: asset-class-parameter-overrides

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/allocation/assetClasses.ts`

```diff
@@ -90,7 +90,7 @@ export function resolveAssetClassParams(
     resolved[id] = {
       label: d.label,
       returnPct: o?.returnPct ?? d.returnPct,
-      volatilityPct: o?.volatilityPct ?? d.volatilityPct,
+      volatilityPct: o ? (o.volatilityPct ?? 0) : d.volatilityPct,
       interestYieldPct: o?.interestYieldPct ?? d.interestYieldPct,
       dividendYieldPct: o?.dividendYieldPct ?? d.dividendYieldPct,
       qualifiedRatioPct: o?.qualifiedRatioPct ?? d.qualifiedRatioPct,
```

This swaps the whole bonds record for the override whenever an override object is present, the worksheet's first wrong reading: the absent volatility becomes 0 instead of the 7.7 default, a 7.7 miss against the absolute bound of 0. The whole-record assertion fails on the same field; the US-stock assertion passes because no override names that class.

## Command

```
npx vitest run src/allocation/assetClasses.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/allocation/assetClasses.evidence.test.ts (32 tests | 2 failed) 11ms
   ❯ asset-class-parameter-overrides — Asset-class parameters: assumption overrides laid over the sourced defaults (5)
     × takes the bonds return from the override and keeps its volatility at the 7.7 default 4ms
     × preserves every other bonds field and the label: the override is laid over the record, not swapped for it 2ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > asset-class-parameter-overrides — Asset-class parameters: assumption overrides laid over the sourced defaults > takes the bonds return from the override and keeps its volatility at the 7.7 default
AssertionError: bonds.volatilityPct 0 is not within {"abs":0} of the worksheet's 7.7: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:121:9
    119|         withinTolerance(resolved.bonds.volatilityPct, expectedVolatili…
    120|         `bonds.volatilityPct ${resolved.bonds.volatilityPct} is not wi…
    121|       ).toBe(true)
       |         ^
    122|     })
    123|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > asset-class-parameter-overrides — Asset-class parameters: assumption overrides laid over the sourced defaults > preserves every other bonds field and the label: the override is laid over the record, not swapped for it
AssertionError: expected { label: 'Bonds', returnPct: 5, …(4) } to deeply equal { label: 'Bonds', returnPct: 5, …(4) }
- Expected
+ Received
@@ -2,7 +2,7 @@
    "dividendYieldPct": 0,
    "interestYieldPct": 4,
    "label": "Bonds",
    "qualifiedRatioPct": 0,
    "returnPct": 5,
-   "volatilityPct": 7.7,
+   "volatilityPct": 0,
  }
 ❯ src/allocation/assetClasses.evidence.test.ts:133:30
    131|
    132|     it('preserves every other bonds field and the label: the override …
    133|       expect(resolved.bonds).toEqual({ ...DEFAULT_ASSET_CLASS_PARAMS.b…
       |                              ^
    134|     })
    135|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
 Test Files  1 failed (1)
      Tests  2 failed | 30 passed (32)
```

## Revert

`git checkout -- packages/engine/src/allocation/assetClasses.ts`, then `git diff --quiet -- packages/engine/src/allocation/assetClasses.ts` exited 0, confirming no change to production code after the run.
