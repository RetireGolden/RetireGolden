# Mutation receipt: year-result-ltcg-zero-headroom

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-thirteen` at base `1452ae11`, and re-executed 2026-09-22 against RetireGolden base `fca01300` (branch `claude/b1-p4-cards-eleven-fourteen`, pull request #730) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/federalTax.ts`

```diff
diff --git a/packages/engine/src/tax/federalTax.ts b/packages/engine/src/tax/federalTax.ts
index 8cae7295..faab2722 100644
--- a/packages/engine/src/tax/federalTax.ts
+++ b/packages/engine/src/tax/federalTax.ts
@@ -293,7 +293,7 @@ export function zeroRateLtcgHeadroom(
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

Re-executed 2026-09-22 on the pull-request branch after the review of #730: the branch was renamed for the pull request, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (simulate.ltcgZeroHeadroom.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts (2 tests | 2 failed) 30ms
   ❯ year-result-ltcg-zero-headroom — 0% long-term-gains headroom: the unused layer under the 15% threshold (2)
     × publishes 12450 of 0% headroom for a 37000 taxable income 27ms
     × publishes exactly 0 once taxable income reaches the 15% threshold 2ms

 Test Files  1 failed (1)
      Tests  2 failed (2)

  Transform  transforming modules took 2.38s · 45% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts > year-result-ltcg-zero-headroom — 0% long-term-gains headroom: the unused layer under the 15% threshold > publishes 12450 of 0% headroom for a 37000 taxable income
AssertionError: ltcgZeroHeadroom 508499.9969229102 is not within {"abs":0.005} of 12450: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts:70:9
     68|         withinTolerance(row.ltcgZeroHeadroom, expected.caseAHeadroom!,…
     69|         `ltcgZeroHeadroom ${row.ltcgZeroHeadroom} is not within ${JSON…
     70|       ).toBe(true)
       |         ^
     71|       // ... and the published figure is that threshold minus taxable …
     72|       expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts > year-result-ltcg-zero-headroom — 0% long-term-gains headroom: the unused layer under the 15% threshold > publishes exactly 0 once taxable income reaches the 15% threshold
AssertionError: expected 495499.994084239 to be +0 // Object.is equality

- Expected
+ Received

- 0
+ 495499.994084239

 ❯ src/projection/simulate.ltcgZeroHeadroom.evidence.test.ts:93:36
     91|       // The at-threshold branch returns before any bisection, so this…
     92|       // exact zero rather than a tolerance.
     93|       expect(row.ltcgZeroHeadroom).toBe(expected.caseBHeadroom)
       |                                    ^
     94|       // The worksheet's second wrong reading: an unfloored subtractio…
     95|       expect(row.ltcgZeroHeadroom).not.toBe(threshold - taxableIncome)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/federalTax.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/federalTax.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
