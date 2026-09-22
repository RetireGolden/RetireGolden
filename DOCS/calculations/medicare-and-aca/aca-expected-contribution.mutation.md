# Mutation receipt: aca-expected-contribution

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728) in `packages/engine`.

## Mutation applied to `packages/engine/src/tax/aca.ts`

```diff
@@ -123,7 +123,7 @@ export function acaFederalPovertyLine(
 ): number {
   const table = pack.federalPovertyLine[region]
   return (
-    (table.firstPerson + table.perAdditionalPerson * Math.max(0, householdSize - 1)) *
+    (table.firstPerson + table.perAdditionalPerson * 0) *
     fplScale
   )
 }
```

This counts only the first person in the poverty line, so a two-person household is measured against $15,650 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/tax/aca.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #728: the branch was renamed for the pull request and two fixtures and one mutation changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (aca.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/tax/aca.evidence.test.ts (13 tests | 5 failed) 8ms
   ❯ aca-400-percent-cliff — ACA 400% FPL cliff (3)
     × allows the credit at exactly 400% of the poverty line 4ms
   ❯ aca-expected-contribution — ACA expected contribution (2)
     × builds a 21,150 poverty line for two people and contributes 6.60% of 42,300 0ms
     × counts every household member in the poverty line, not just the first 0ms
   ❯ aca-allowable-premium-tax-credit — ACA modeled allowable premium tax credit (3)
     × credits the 12,000 benchmark less the 2,791.80 contribution, under the 10,000 enrollment cap 0ms
   ❯ aca-economic-net-premium — ACA economic net premium (2)
     × bears 791.80 of the 10,000 gross premium after a 9,208.20 credit 0ms

 Test Files  1 failed (1)
      Tests  5 failed | 8 passed (13)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-400-percent-cliff — ACA 400% FPL cliff > allows the credit at exactly 400% of the poverty line
AssertionError: expected 15650 to be 21150 // Object.is equality

- Expected
+ Received

- 21150
+ 15650

 ❯ src/tax/aca.evidence.test.ts:72:66
     70|     it('allows the credit at exactly 400% of the poverty line', () => {
     71|       expect(pack.aca.maxFplPctForCredit).toBe(inputs.maxFplPctForCred…
     72|       expect(acaFederalPovertyLine(pack, inputs.householdSize!)).toBe(…
       |                                                                  ^
     73|       const atCliff = resultFor(inputs.magiAtCliff!)
     74|       expect(atCliff.overCliff).toBe(false)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/5]⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-expected-contribution — ACA expected contribution > builds a 21,150 poverty line for two people and contributes 6.60% of 42,300
AssertionError: expected 15650 to be 21150 // Object.is equality

- Expected
+ Received

- 21150
+ 15650

 ❯ src/tax/aca.evidence.test.ts:140:66
    138|       expect(pack.federalPovertyLine.contiguous.perAdditionalPerson).t…
    139|       // The worksheet's FPL and FPL percentage are exact integers.
    140|       expect(acaFederalPovertyLine(pack, inputs.householdSize!)).toBe(…
       |                                                                  ^
    141|       expect(acaApplicablePct(pack, expected.fplPct!)).toBe(inputs.app…
    142|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/5]⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-expected-contribution — ACA expected contribution > counts every household member in the poverty line, not just the first
AssertionError: expected 15650 to be greater than 15650
 ❯ src/tax/aca.evidence.test.ts:164:66
    162|       const onePersonLine = acaFederalPovertyLine(pack, 1)
    163|       expect(onePersonLine).toBe(inputs.firstPersonFpl)
    164|       expect(acaFederalPovertyLine(pack, inputs.householdSize!)).toBeG…
       |                                                                  ^
    165|     })
    166|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/5]⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-allowable-premium-tax-credit — ACA modeled allowable premium tax credit > credits the 12,000 benchmark less the 2,791.80 contribution, under the 10,000 enrollment cap
AssertionError: expectedContribution 3831.001533546326 is not within {"abs":0.005} of the worksheet's 2791.8: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/aca.evidence.test.ts:28:5
     26|     withinTolerance(actual, expected, tolerance),
     27|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     28|   ).toBe(true)
       |     ^
     29| }
     30|
 ❯ src/tax/aca.evidence.test.ts:199:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/5]⎯

 FAIL  src/tax/aca.evidence.test.ts > aca-economic-net-premium — ACA economic net premium > bears 791.80 of the 10,000 gross premium after a 9,208.20 credit
AssertionError: modeledAllowablePtc 8168.998466453675 is not within {"abs":0.005} of the worksheet's 9208.2: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/tax/aca.evidence.test.ts:28:5
     26|     withinTolerance(actual, expected, tolerance),
     27|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     28|   ).toBe(true)
       |     ^
     29| }
     30|
 ❯ src/tax/aca.evidence.test.ts:270:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
```

## Revert

The original bytes of `packages/engine/src/tax/aca.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/tax/aca.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
