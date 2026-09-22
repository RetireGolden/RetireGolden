# Mutation receipt: sepp-amortization-method

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/sepp.ts`

```diff
@@ -83,6 +83,6 @@ export function seppAnnualAmount(
   // Amortization: level payment amortizing `balance` over `lifeExpectancy` years
   // at `ratePct`. With r = 0 this degenerates to balance ÷ years.
   const r = ratePct / 100
-  if (r === 0) return balance / lifeExpectancy
+  if (r >= 0) return balance / lifeExpectancy
   return (balance * r) / (1 - Math.pow(1 + r, -lifeExpectancy))
 }
```

This takes the zero-rate degeneration at every rate, dividing the balance by the term for $10,000 despite a 5% rate — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/sepp.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (sepp.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/strategies/sepp.evidence.test.ts (10 tests | 2 failed) 7ms
   ❯ sepp-amortization-method — SEPP amortization-method annual amount (3)
     × amortizes 316,000 over the 31.6-year term at 5% into 20,101.84 a year 3ms
     × does not degenerate to simple division while the rate is nonzero 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 8 passed (10)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/strategies/sepp.evidence.test.ts > sepp-amortization-method — SEPP amortization-method annual amount > amortizes 316,000 over the 31.6-year term at 5% into 20,101.84 a year
AssertionError: annualAmount 10000 is not within {"abs":0.005} of the worksheet's 20101.84: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/strategies/sepp.evidence.test.ts:24:5
     22|     withinTolerance(actual, expected, tolerance),
     23|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     24|   ).toBe(true)
       |     ^
     25| }
     26|
 ❯ src/strategies/sepp.evidence.test.ts:131:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/strategies/sepp.evidence.test.ts > sepp-amortization-method — SEPP amortization-method annual amount > does not degenerate to simple division while the rate is nonzero
AssertionError: expected 10000 to be greater than 10000
 ❯ src/strategies/sepp.evidence.test.ts:142:22
    140|         inputs.startAge as number,
    141|       )
    142|       expect(amount).toBeGreaterThan(
       |                      ^
    143|         (inputs.firstYearBalance as number) / (inputs.singleLifeTerm a…
    144|       )

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/strategies/sepp.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/strategies/sepp.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
