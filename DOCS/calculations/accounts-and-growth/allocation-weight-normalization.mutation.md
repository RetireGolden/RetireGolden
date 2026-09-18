# Mutation receipt: allocation-weight-normalization

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch claude/b1-p4-cards-accounts-spending) in `packages/engine`.

## Mutation applied to `packages/engine/src/allocation/assetClasses.ts`

```diff
@@ -104,7 +104,7 @@ export function weightsToVector(weights: AllocationWeights): number[] {
   const raw = ASSET_CLASS_IDS.map((id) => Math.max(0, weights[id]))
   const total = raw.reduce((a, b) => a + b, 0)
   if (total <= 0) return ASSET_CLASS_IDS.map((id) => (id === 'cash' ? 1 : 0))
-  return raw.map((w) => w / total)
+  return raw
 }
 
 function lerpVectors(a: number[], b: number[], t: number): number[] {
```

This returns the floored percent weights without dividing by their total, the worksheet's first wrong reading: [60, 20, 20, 0] instead of [0.6, 0.2, 0.2, 0], summing to 100. Every allocation calculation that reads the vector fails with it: the glidepath endpoints and staged reads come back in percent, and the account blend reads 580 instead of 5.8 (the ledger-parity assertion fails alongside it because the ledger phase is driven with the same mutated vector). Only the zero-total all-cash endpoint passes, because that branch precedes the mutated line.

## Command

```
npx vitest run src/allocation/assetClasses.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`, stdout and stderr together; stdout precedes stderr, so the run summary appears before the failed-test detail. Blank lines, the `Start at` and `Duration` lines, and Vitest's transform-cache performance hint (when printed) are the only lines removed. The run exited 1.

```
 RUN  v5.0.0 C:/TEMP/rg-s5/packages/engine
 ❯ src/allocation/assetClasses.evidence.test.ts (32 tests | 8 failed) 10ms
   ❯ allocation-weight-normalization — Allocation weights to a normalized fraction vector in class order (4)
     × normalizes 60/20/20/0 to [0.6, 0.2, 0.2, 0] in ASSET_CLASS_IDS order 4ms
     × the components sum to 1 0ms
     × keeps class order positional: a 20/0/60/20 record puts the 60 at the bonds index, never sorted by magnitude 0ms
   ❯ allocation-glidepath-interpolation — Glidepath compilation: linear interpolation with flat endpoints, staged as a step function (5)
     × clamps flat to the from vector at 2015 and the to vector at 2035 0ms
     × returns the endpoint vectors at the 2020 and 2030 knots 0ms
     × a staged policy holds each stage from its year as a step: 2025 still reads the 2020 stage 0ms
   ❯ allocation-account-expected-return — Expected return for an account: allocation blend, else account rate, else plan default (4)
     × uses the 5.8% blend and ignores the 9% account scalar when the account carries an allocation 0ms
     × the ledger's growth phase also ignores the 9% scalar for an allocated account: 5.8% at zero shock 0ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 8 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-weight-normalization — Allocation weights to a normalized fraction vector in class order > normalizes 60/20/20/0 to [0.6, 0.2, 0.2, 0] in ASSET_CLASS_IDS order
AssertionError: vector[0] 60 is not within {"abs":1e-12} of the worksheet's 0.6: expected false to be true // Object.is equality
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
 ❯ src/allocation/assetClasses.evidence.test.ts:159:7
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/8]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-weight-normalization — Allocation weights to a normalized fraction vector in class order > the components sum to 1
AssertionError: sum 100 is not within {"abs":1e-12} of the worksheet's 1: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:168:9
    166|         withinTolerance(sum, expected, example.tolerance),
    167|         `sum ${sum} is not within ${JSON.stringify(example.tolerance)}…
    168|       ).toBe(true)
       |         ^
    169|     })
    170|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/8]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-weight-normalization — Allocation weights to a normalized fraction vector in class order > keeps class order positional: a 20/0/60/20 record puts the 60 at the bonds index, never sorted by magnitude
AssertionError: vector(20/0/60/20)[0] 20 is not within {"abs":1e-12} of the worksheet's 0.2: expected false to be true // Object.is equality
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
 ❯ src/allocation/assetClasses.evidence.test.ts:175:7
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/8]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-glidepath-interpolation — Glidepath compilation: linear interpolation with flat endpoints, staged as a step function > clamps flat to the from vector at 2015 and the to vector at 2035
AssertionError: at2015[0] 80 is not within {"abs":1e-12} of the worksheet's 0.8: expected false to be true // Object.is equality
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
 ❯ src/allocation/assetClasses.evidence.test.ts:224:7
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/8]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-glidepath-interpolation — Glidepath compilation: linear interpolation with flat endpoints, staged as a step function > returns the endpoint vectors at the 2020 and 2030 knots
AssertionError: at2020[0] 80 is not within {"abs":1e-12} of the worksheet's 0.8: expected false to be true // Object.is equality
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
 ❯ src/allocation/assetClasses.evidence.test.ts:229:7
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/8]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-glidepath-interpolation — Glidepath compilation: linear interpolation with flat endpoints, staged as a step function > a staged policy holds each stage from its year as a step: 2025 still reads the 2020 stage
AssertionError: staged 2025[0] 80 is not within {"abs":1e-12} of the worksheet's 0.8: expected false to be true // Object.is equality
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
 ❯ src/allocation/assetClasses.evidence.test.ts:244:7
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/8]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-account-expected-return — Expected return for an account: allocation blend, else account rate, else plan default > uses the 5.8% blend and ignores the 9% account scalar when the account carries an allocation
AssertionError: withAllocationPct 580 is not within {"abs":1e-12} of the worksheet's 5.8: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:344:9
    342|         withinTolerance(rate, expected, example.tolerance),
    343|         `withAllocationPct ${rate} is not within ${JSON.stringify(exam…
    344|       ).toBe(true)
       |         ^
    345|     })
    346|
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/8]⎯
 FAIL  src/allocation/assetClasses.evidence.test.ts > allocation-account-expected-return — Expected return for an account: allocation blend, else account rate, else plan default > the ledger's growth phase also ignores the 9% scalar for an allocated account: 5.8% at zero shock
AssertionError: ledger growth 580 is not within {"abs":1e-12} of the worksheet's 5.8: expected false to be true // Object.is equality
- Expected
+ Received
- true
+ false
 ❯ src/allocation/assetClasses.evidence.test.ts:370:9
    368|         withinTolerance(ledger, expected, example.tolerance),
    369|         `ledger growth ${ledger} is not within ${JSON.stringify(exampl…
    370|       ).toBe(true)
       |         ^
    371|     })
    372|   },
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/8]⎯
 Test Files  1 failed (1)
      Tests  8 failed | 24 passed (32)
```

## Revert

`git checkout -- packages/engine/src/allocation/assetClasses.ts`, then `git diff --quiet -- packages/engine/src/allocation/assetClasses.ts` exited 0, confirming no change to production code after the run.
