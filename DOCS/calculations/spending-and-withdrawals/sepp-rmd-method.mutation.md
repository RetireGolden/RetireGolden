# Mutation receipt: sepp-rmd-method

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/strategies/sepp.ts`

```diff
@@ -79,7 +79,7 @@ export function seppAnnualAmount(
 ): number {
   if (balance <= 0) return 0
   const lifeExpectancy = singleLifeExpectancyYears(pack, age)
-  if (method === 'rmd') return balance / lifeExpectancy
+  if (method === 'rmd') return balance / (pack.rmd.uniformLifetimeTable[Math.floor(age)] as number)
   // Amortization: level payment amortizing `balance` over `lifeExpectancy` years
   // at `ratePct`. With r = 0 this degenerates to balance ÷ years.
   const r = ratePct / 100
```

This divides by the Uniform Lifetime Table entry instead of the Single Life divisor; the pack carries no age-55 Uniform entry, so the payment is NaN — the worksheet's first wrong reading, that an age-55 Uniform Lifetime lookup is unsupported.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/strategies/sepp.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (sepp.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/strategies/sepp.evidence.test.ts (10 tests | 2 failed) 7ms
   ❯ sepp-active-annual-rule — SEPP active in an attained-age year (4)
     × is still active at 59, four elapsed years and below the age-60 boundary 3ms
   ❯ sepp-rmd-method — SEPP RMD-method annual amount (3)
     × divides the 316,000 start-of-year balance by the age-55 divisor 31.6 2ms

 Test Files  1 failed (1)
      Tests  2 failed | 8 passed (10)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/strategies/sepp.evidence.test.ts > sepp-active-annual-rule — SEPP active in an attained-age year > is still active at 59, four elapsed years and below the age-60 boundary
RangeError: Plan dollar balance must be finite, nonnegative, and not negative zero
 ❯ planDollarsToRoundedCentsBigInt src/actions/planBalanceAdapter.ts:27:11
     25| function planDollarsToRoundedCentsBigInt(dollars: number): bigint {
     26|   if (!Number.isFinite(dollars) || dollars < 0 || Object.is(dollars, -…
     27|     throw new RangeError('Plan dollar balance must be finite, nonnegat…
       |           ^
     28|   }
     29|
 ❯ planDollarsToLedgerCents src/actions/planBalanceAdapter.ts:49:17
 ❯ planDollarsMoveNoLedgerCent src/actions/planBalanceAdapter.ts:102:10
 ❯ annualSeppDistributions src/projection/internal/annualSeppDistributions.ts:164:22
 ❯ runAtAge src/strategies/sepp.evidence.test.ts:64:14
 ❯ src/strategies/sepp.evidence.test.ts:79:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/strategies/sepp.evidence.test.ts > sepp-rmd-method — SEPP RMD-method annual amount > divides the 316,000 start-of-year balance by the age-55 divisor 31.6
AssertionError: annualAmount NaN is not within "exact" of the worksheet's 10000: expected false to be true // Object.is equality

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
 ❯ src/strategies/sepp.evidence.test.ts:188:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/strategies/sepp.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/strategies/sepp.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
