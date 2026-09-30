# Mutation receipt: oasdi-tax-rate-history

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `deeb732a` (branch `claude/b2p1-slice4-ss-models`, pull request #757) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/oasdiTaxRates.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/oasdiTaxRates.ts b/packages/engine/src/socialSecurity/oasdiTaxRates.ts
index 81627938..d0356897 100644
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

PR #757 review 4 moved the evidence tests off the worksheets onto the committed BLS and SSA source files, so the tests' titles, counts and lines changed; the mutations are unchanged. The baseline is green (oasdiTaxRates.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/socialSecurity/oasdiTaxRates.evidence.test.ts (3 tests | 2 failed) 15ms
   ❯ oasdi-tax-rate-history — Social Security tax rates by year (3)
     × carries SSA's effective rate for every year 1937 to 2026, each payer, as the page's table and footnotes give it 10ms
     × the parser reads the footnotes: 1984's employee credit to 5.4 and the 2011-2012 reduction to 4.2 and 10.4, not the employer's 3ms

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/oasdiTaxRates.evidence.test.ts > oasdi-tax-rate-history — Social Security tax rates by year > carries SSA's effective rate for every year 1937 to 2026, each payer, as the page's table and footnotes give it
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "1984: {\"employee\":5.7,\"employer\":5.7,\"selfEmployed\":11.4} against the page's {\"employee\":5.4,\"employer\":5.7,\"selfEmployed\":11.4}",
+ ]

 ❯ src/socialSecurity/oasdiTaxRates.evidence.test.ts:42:26
     40|         }
     41|       }
     42|       expect(mismatches).toEqual([])
       |                          ^
     43|     })
     44|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/oasdiTaxRates.evidence.test.ts > oasdi-tax-rate-history — Social Security tax rates by year > the parser reads the footnotes: 1984's employee credit to 5.4 and the 2011-2012 reduction to 4.2 and 10.4, not the employer's
AssertionError: expected { employee: 5.7, employer: 5.7, …(1) } to deeply equal { employee: 5.4, employer: 5.7, …(1) }

- Expected
+ Received

  {
-   "employee": 5.4,
+   "employee": 5.7,
    "employer": 5.7,
    "selfEmployed": 11.4,
  }

 ❯ src/socialSecurity/oasdiTaxRates.evidence.test.ts:58:44
     56|       expect(effective.get(2012)).toEqual({ employee: 4.2, employer: 6…
     57|       expect(effective.get(2013)).toEqual({ employee: 6.2, employer: 6…
     58|       expect(OASDI_TAX_RATE_BY_YEAR[1984]).toEqual({ employee: expecte…
       |                                            ^
     59|       expect(OASDI_TAX_RATE_BY_YEAR[2011]).toEqual({ employee: expecte…
     60|       expect(OASDI_TAX_RATE_BY_YEAR[2012]).toEqual(OASDI_TAX_RATE_BY_Y…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/oasdiTaxRates.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/oasdiTaxRates.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
