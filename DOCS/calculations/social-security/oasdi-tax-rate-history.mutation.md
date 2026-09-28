# Mutation receipt: oasdi-tax-rate-history

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/oasdiTaxRates.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/oasdiTaxRates.ts b/packages/engine/src/socialSecurity/oasdiTaxRates.ts
index 68535ffb..c876d6d3 100644
--- a/packages/engine/src/socialSecurity/oasdiTaxRates.ts
+++ b/packages/engine/src/socialSecurity/oasdiTaxRates.ts
@@ -82,7 +82,7 @@ export const OASDI_TAX_RATE_BY_YEAR: Readonly<Record<number, OasdiTaxRates>> = {
   1981: { employee: 5.35, employer: 5.35, selfEmployed: 8 },
   1982: { employee: 5.4, employer: 5.4, selfEmployed: 8.05 },
   1983: { employee: 5.4, employer: 5.4, selfEmployed: 8.05 },
-  1984: { employee: 5.4, employer: 5.7, selfEmployed: 11.4 },
+  1984: { employee: 5.7, employer: 5.7, selfEmployed: 11.4 },
   1985: { employee: 5.7, employer: 5.7, selfEmployed: 11.4 },
   1986: { employee: 5.7, employer: 5.7, selfEmployed: 11.4 },
   1987: { employee: 5.7, employer: 5.7, selfEmployed: 11.4 },
```

This drops the employee's 1984 credit of footnote a, the trust-fund rate as the employee's (the worksheet's second wrong reading, in one year): the transcription check and the footnote check both fail.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/oasdiTaxRates.evidence.test.ts
```

## Captured failing output

The baseline is green (oasdiTaxRates.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine13/packages/engine

 ❯ src/socialSecurity/oasdiTaxRates.evidence.test.ts (2 tests | 2 failed) 7ms
   ❯ oasdi-tax-rate-history — Social Security tax rates by year (2)
     × carries SSA's effective rate for every year 1937 to 2026, as the worksheet transcribes the table 5ms
     × applies the footnotes: the employee's 1984 credit and the 2011-2012 reduction, not the employer's 1ms

 Test Files  1 failed (1)
      Tests  2 failed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/oasdiTaxRates.evidence.test.ts > oasdi-tax-rate-history — Social Security tax rates by year > carries SSA's effective rate for every year 1937 to 2026, as the worksheet transcribes the table
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "1984: {\"employee\":5.7,\"employer\":5.7,\"selfEmployed\":11.4} against {\"employee\":5.4,\"employer\":5.7,\"selfEmployed\":11.4}",
+ ]

 ❯ src/socialSecurity/oasdiTaxRates.evidence.test.ts:41:26
     39|         }
     40|       }
     41|       expect(mismatches).toEqual([])
       |                          ^
     42|     })
     43|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/oasdiTaxRates.evidence.test.ts > oasdi-tax-rate-history — Social Security tax rates by year > applies the footnotes: the employee's 1984 credit and the 2011-2012 reduction, not the employer's
AssertionError: expected { employee: 5.7, employer: 5.7, …(1) } to deeply equal { employee: 5.4, employer: 5.7, …(1) }

- Expected
+ Received

  {
-   "employee": 5.4,
+   "employee": 5.7,
    "employer": 5.7,
    "selfEmployed": 11.4,
  }

 ❯ src/socialSecurity/oasdiTaxRates.evidence.test.ts:45:44
     43|
     44|     it('applies the footnotes: the employee\'s 1984 credit and the 201…
     45|       expect(OASDI_TAX_RATE_BY_YEAR[1984]).toEqual({ employee: expecte…
       |                                            ^
     46|       expect(OASDI_TAX_RATE_BY_YEAR[2011]).toEqual({ employee: expecte…
     47|       expect(OASDI_TAX_RATE_BY_YEAR[2012]).toEqual(OASDI_TAX_RATE_BY_Y…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/oasdiTaxRates.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/oasdiTaxRates.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
