# Mutation receipt: allocation-glidepath-interpolation

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/allocation/assetClasses.ts`

```diff
@@ -127,7 +127,7 @@ export function targetWeightsAt(policy: AssetAllocationPolicy, year: number): nu
     case 'linear': {
       const from = weightsToVector(policy.from)
       const to = weightsToVector(policy.to)
-      if (year <= policy.startYear || policy.endYear <= policy.startYear) return from
+      if (year < policy.endYear || policy.endYear <= policy.startYear) return from
       if (year >= policy.endYear) return to
       return lerpVectors(from, to, (year - policy.startYear) / (policy.endYear - policy.startYear))
     }
```

This turns the linear glidepath into a step that holds the from vector until the end year, the worksheet's first wrong reading: at 2025 the mutated code returns [0.8, 0, 0.2, 0] instead of [0.7, 0, 0.3, 0], a 0.1 miss on the first component against the 1e-12 tolerance. The flat-endpoint, knot, staged and custom assertions still pass, because the clamps and the other modes are untouched.

## Command

```
npx vitest run src/allocation/assetClasses.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/allocation/assetClasses.evidence.test.ts (32 tests | 1 failed) 9ms
   ❯ allocation-glidepath-interpolation — Glidepath compilation: linear interpolation with flat endpoints, staged as a step function (5)
     × interpolates [0.7, 0.3] halfway through the 2020-2030 glidepath at 2025 4ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-glidepath-interpolation — Glidepath compilation: linear interpolation with flat endpoints, staged as a step function > interpolates [0.7, 0.3] halfway through the 2020-2030 glidepath at 2025
AssertionError: at2025[0] 0.8 is not within {"abs":1e-12} of the worksheet's 0.7: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:47:7
     45|       withinTolerance(actual[index]!, value, tolerance),
     46|       `${label}[${index}] ${actual[index]} is not within ${JSON.string…
     47|     ).toBe(true)
       |       ^
     48|   })
     49| }
 ❯ expectVector src/allocation/assetClasses.evidence.test.ts:43:12
 ❯ src/allocation/assetClasses.evidence.test.ts:220:7
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed (1)
      Tests  1 failed | 31 passed (32)
```

## Revert

`git checkout -- packages/engine/src/allocation/assetClasses.ts`, then `git diff --quiet -- packages/engine/src/allocation/assetClasses.ts` exited 0, confirming no change to production code after the run.
