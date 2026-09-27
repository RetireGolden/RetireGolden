# Mutation receipt: spia-payout-rate-interpolation

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/spiaQuotes.ts`

```diff
diff --git a/packages/engine/src/decisions/spiaQuotes.ts b/packages/engine/src/decisions/spiaQuotes.ts
index a076dfeb..825b5c77 100644
--- a/packages/engine/src/decisions/spiaQuotes.ts
+++ b/packages/engine/src/decisions/spiaQuotes.ts
@@ -44,7 +44,7 @@ export function spiaPayoutRate(startAge: number): number {
   for (let i = 0; i < points.length - 1; i++) {
     const [a0, r0] = points[i]!
     const [a1, r1] = points[i + 1]!
-    if (startAge >= a0 && startAge <= a1) return r0 + ((r1 - r0) * (startAge - a0)) / (a1 - a0)
+    if (startAge >= a0 && startAge <= a1) return r0
   }
   return last[1]
 }
```

Nearest-lower-anchor selection instead of linear interpolation, the worksheet's first wrong reading (0.070 rather than 0.077).

## Command

```
npx vitest run src/decisions/spiaQuotes.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (spiaQuotes.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/decisions/spiaQuotes.evidence.test.ts (5 tests | 3 failed) 6ms
   ❯ spia-payout-rate-interpolation — Life-only SPIA payout-rate linear interpolation (3)
     × interpolates 0.077 at age 67.5 between the 65 and 70 anchors 3ms
     × $100,000 of premium at that rate pays $7,700 per year 0ms
     × the 65 and 70 anchors the interpolation uses are 0.070 and 0.084 0ms

 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/spiaQuotes.evidence.test.ts > spia-payout-rate-interpolation — Life-only SPIA payout-rate linear interpolation > interpolates 0.077 at age 67.5 between the 65 and 70 anchors
AssertionError: rate 0.07 is not within {"abs":1e-12} of the worksheet's 0.077: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/spiaQuotes.evidence.test.ts:55:9
     53|         withinTolerance(rate, expectedRate, example.tolerance),
     54|         `rate ${rate} is not within ${JSON.stringify(example.tolerance…
     55|       ).toBe(true)
       |         ^
     56|     })
     57|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/decisions/spiaQuotes.evidence.test.ts > spia-payout-rate-interpolation — Life-only SPIA payout-rate linear interpolation > $100,000 of premium at that rate pays $7,700 per year
AssertionError: annualPayout 7000.000000000001 is not within {"abs":1e-12} of the worksheet's 7700: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/spiaQuotes.evidence.test.ts:64:9
     62|         withinTolerance(annual, expected, example.tolerance),
     63|         `annualPayout ${annual} is not within ${JSON.stringify(example…
     64|       ).toBe(true)
       |         ^
     65|     })
     66|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/decisions/spiaQuotes.evidence.test.ts > spia-payout-rate-interpolation — Life-only SPIA payout-rate linear interpolation > the 65 and 70 anchors the interpolation uses are 0.070 and 0.084
AssertionError: age-65 rate 0.06 is not the worksheet's 0.07: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/decisions/spiaQuotes.evidence.test.ts:71:9
     69|         withinTolerance(spiaPayoutRate(65), example.inputs.age65Rate a…
     70|         `age-65 rate ${spiaPayoutRate(65)} is not the worksheet's ${ex…
     71|       ).toBe(true)
       |         ^
     72|       expect(
     73|         withinTolerance(spiaPayoutRate(70), example.inputs.age70Rate a…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/decisions/spiaQuotes.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/spiaQuotes.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
