# Mutation receipt: oasdi-paid-in-today-dollars

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `b610eddc` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `1b86d6af` (branch `claude/b2p1-slice4-ss-models`, pull request #757) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/analysis/oasdiReturn.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts b/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts
index a429129e..8b7b610f 100644
--- a/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts
+++ b/packages/engine/src/socialSecurity/analysis/oasdiReturn.ts
@@ -140,7 +140,7 @@ export function oasdiPaidIn(earnings: readonly YearEarning[], options: OasdiPaid
   const years = [...new Set([...entered.keys(), ...projected.keys()])].sort((a, b) => a - b)
   for (const year of years) {
     const rates = ratesForYear(year)
-    const personRate = rates === undefined ? null : options.selfEmployed ? rates.selfEmployed : rates.employee
+    const personRate = rates === undefined ? null : options.selfEmployed ? rates.selfEmployed : rates.employer
     if (rates === undefined || personRate === null) {
       excludedYears.push(year)
       continue
```

This taxes the employee at the trust-fund rate, the employer's, the worksheet's third wrong reading: case A's nominal tax becomes 117,815.60, the employer's figure, because the 1984 credit and the 2011-2012 reduction are lost.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/analysis/oasdiReturn.paidIn.evidence.test.ts
```

## Captured failing output

Its production file's lines moved when the latest tax-rate year became a constant (PR #757 review 5), so it is re-executed on the current code. The baseline is green (oasdiReturn.paidIn.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine13/packages/engine

 ❯ src/socialSecurity/analysis/oasdiReturn.paidIn.evidence.test.ts (8 tests | 2 failed) 7ms
   ❯ oasdi-paid-in-today-dollars — Social Security tax paid in, in today's dollars (8)
     × case A: each year's effective rate and base, restated by CPI-U to 2025 and 2.5% to 2026 (225,418.24) 4ms
     × case P: the projection's years 2026 to 2042 are the projected work, 17 x 3,720, beside the 116,507.46 paid in so far 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 6 passed (8)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/analysis/oasdiReturn.paidIn.evidence.test.ts > oasdi-paid-in-today-dollars — Social Security tax paid in, in today's dollars > case A: each year's effective rate and base, restated by CPI-U to 2025 and 2.5% to 2026 (225,418.24)
AssertionError: A paidInNominal 117815.6: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectCase src/socialSecurity/analysis/oasdiReturn.paidIn.evidence.test.ts:29:124
     27|   const nominal = { abs: 1e-6 }
     28|   const today = { rel: 1e-12 }
     29|   expect(withinTolerance(result.paidInNominal, cell(label, 0), nominal…
       |                                                                                                                            ^
     30|   expect(withinTolerance(result.paidInToday, cell(label, 1), today), `…
     31|   expect(withinTolerance(result.employerNominal, cell(label, 2), nomin…
 ❯ src/socialSecurity/analysis/oasdiReturn.paidIn.evidence.test.ts:50:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/analysis/oasdiReturn.paidIn.evidence.test.ts > oasdi-paid-in-today-dollars — Social Security tax paid in, in today's dollars > case P: the projection's years 2026 to 2042 are the projected work, 17 x 3,720, beside the 116,507.46 paid in so far
AssertionError: P paidInNominal 85560: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectCase src/socialSecurity/analysis/oasdiReturn.paidIn.evidence.test.ts:29:124
     27|   const nominal = { abs: 1e-6 }
     28|   const today = { rel: 1e-12 }
     29|   expect(withinTolerance(result.paidInNominal, cell(label, 0), nominal…
       |                                                                                                                            ^
     30|   expect(withinTolerance(result.paidInToday, cell(label, 1), today), `…
     31|   expect(withinTolerance(result.employerNominal, cell(label, 2), nomin…
 ❯ src/socialSecurity/analysis/oasdiReturn.paidIn.evidence.test.ts:73:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/analysis/oasdiReturn.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/analysis/oasdiReturn.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
