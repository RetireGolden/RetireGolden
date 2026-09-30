# Mutation receipt: year-result-ltcg-zero-headroom

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
diff --git a/packages/engine/src/tax/federalTax.ts b/packages/engine/src/tax/federalTax.ts
index cb912c8d..2efda9be 100644
--- a/packages/engine/src/tax/federalTax.ts
+++ b/packages/engine/src/tax/federalTax.ts
@@ -299,7 +299,7 @@ export function zeroRateLtcgHeadroom(
   taxExemptInterest = 0,
   foreignExclusionAddback = 0,
 ): number {
-  const threshold = pack.capitalGains.rate15StartsAbove[filingStatus]
+  const threshold = pack.capitalGains.rate20StartsAbove[filingStatus]
   const taxableIncomeAt = (extraGains: number): number => {
     const agiExcludingSs = ordinaryExcludingSs + currentGains + currentQualifiedDividends + extraGains
     const taxableSs = taxableSocialSecurity(
```

Measure the headroom against the 20% threshold instead of the 15% one — the worksheet's third wrong reading. Case A reports $508,499.997 (the worksheet's $508,500, to the bisection's own $0.01 stopping width) instead of $12,450, and Case B stops being the at-threshold branch at all: it bisects to $495,499.994 instead of returning exactly 0.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its hunk header named a line its production code has since moved from and the test lines it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (simulate.ltcgZeroHeadroom.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts (4 tests | 4 failed) 33ms
   ❯ year-result-ltcg-zero-headroom — 0% long-term-gains headroom: the unused layer under the 15% threshold (4)
     × publishes 12450 of 0% headroom for a 37000 taxable income 28ms
     × publishes exactly 0 once taxable income reaches the 15% threshold 2ms
     × publishes 55550 of 0% headroom for 10000 of ordinary income, below the deduction 1ms
     × publishes 65550 of 0% headroom for 0 of ordinary income, below the deduction 1ms

 Test Files  1 failed (1)
      Tests  4 failed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts > year-result-ltcg-zero-headroom — 0% long-term-gains headroom: the unused layer under the 15% threshold > publishes 12450 of 0% headroom for a 37000 taxable income
AssertionError: ltcgZeroHeadroom 508499.9969229102 is not within {"abs":0.005} of 12450: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts:81:9
     79|         withinTolerance(row.ltcgZeroHeadroom, expected.caseAHeadroom!,…
     80|         `ltcgZeroHeadroom ${row.ltcgZeroHeadroom} is not within ${JSON…
     81|       ).toBe(true)
       |         ^
     82|       // ... and the published figure is that threshold minus taxable …
     83|       expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts > year-result-ltcg-zero-headroom — 0% long-term-gains headroom: the unused layer under the 15% threshold > publishes exactly 0 once taxable income reaches the 15% threshold
AssertionError: expected 495499.994084239 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 495499.994084239

 ❯ src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts:104:36
    102|       // The at-threshold branch returns before any bisection, so this…
    103|       // exact zero rather than a tolerance.
    104|       expect(row.ltcgZeroHeadroom).toBe(expected.caseBHeadroom)
       |                                    ^
    105|       // The worksheet's second wrong reading: an unfloored subtractio…
    106|       expect(row.ltcgZeroHeadroom).not.toBe(threshold - taxableIncome)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts > year-result-ltcg-zero-headroom — 0% long-term-gains headroom: the unused layer under the 15% threshold > publishes 55550 of 0% headroom for 10000 of ordinary income, below the deduction
AssertionError: Case C: ltcgZeroHeadroom 551599.9941825867 is not within 0.01 of 55550: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts:130:11
    128|           withinTolerance(row.ltcgZeroHeadroom, root, { abs: width }),
    129|           `Case ${label}: ltcgZeroHeadroom ${row.ltcgZeroHeadroom} is …
    130|         ).toBe(true)
       |           ^
    131|         expect(row.ltcgZeroHeadroom, `Case ${label} sits at or under t…
    132|         // The wrong reading this case exists for: a search bounded by…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts > year-result-ltcg-zero-headroom — 0% long-term-gains headroom: the unused layer under the 15% threshold > publishes 65550 of 0% headroom for 0 of ordinary income, below the deduction
AssertionError: Case D: ltcgZeroHeadroom 561599.9923229218 is not within 0.01 of 65550: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts:130:11
    128|           withinTolerance(row.ltcgZeroHeadroom, root, { abs: width }),
    129|           `Case ${label}: ltcgZeroHeadroom ${row.ltcgZeroHeadroom} is …
    130|         ).toBe(true)
       |           ^
    131|         expect(row.ltcgZeroHeadroom, `Case ${label} sits at or under t…
    132|         // The wrong reading this case exists for: a search bounded by…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/federalTax.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/federalTax.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
