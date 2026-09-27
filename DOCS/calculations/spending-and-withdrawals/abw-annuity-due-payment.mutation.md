# Mutation receipt: abw-annuity-due-payment

Executed 2026-09-14 against RetireGolden base `fb398216` (branch grok/b1-p3c-catalog-scaffold), and re-executed the same day on the round-1 fix pass over `c3799b55` (the fixture now names its inputs `realReturnPct`/`tiltPct` and asserts through `withinTolerance`), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/spending/abw.ts`

```diff
diff --git a/packages/engine/src/spending/abw.ts b/packages/engine/src/spending/abw.ts
index 9d8faf24..a0c6d7fb 100644
--- a/packages/engine/src/spending/abw.ts
+++ b/packages/engine/src/spending/abw.ts
@@ -81,5 +81,5 @@ export function abwAnnualPayment(
   const x = (1 + tiltPct / 100) / (1 + realReturnPct / 100)
   if (!Number.isFinite(x) || x <= 0) return balance / n
   if (Math.abs(x - 1) < 1e-9) return balance / n
-  return (balance * (1 - x)) / (1 - Math.pow(x, n))
+  return (balance * (1 - x) * (1 + realReturnPct / 100)) / (1 - Math.pow(x, n))
 }
```

This turns the beginning-of-period (annuity-due) payment into the end-of-period (ordinary annuity) payment: for B=210, r=10%, g=0, n=2 the closed form gives 121 instead of 110, the first wrong reading in the worksheet.

## Command

```
npx vitest run src/spending/abw.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution) and the test lines and test counts it quoted no longer matched the current test file; the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (abw.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/spending/abw.evidence.test.ts (4 tests | 1 failed) 6ms
   ❯ abw-annuity-due-payment — Amortization-based withdrawal, growing annuity-due payment (1)
     × pays 110 now and 110 next period from 210 at 10% with no growth 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/spending/abw.evidence.test.ts > abw-annuity-due-payment — Amortization-based withdrawal, growing annuity-due payment > pays 110 now and 110 next period from 210 at 10% with no growth
AssertionError: payment 120.99999999999999 is not within {"abs":1e-9} of the worksheet's 110: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/spending/abw.evidence.test.ts:33:9
     31|         withinTolerance(payment, expected, example.tolerance),
     32|         `payment ${payment} is not within ${JSON.stringify(example.tol…
     33|       ).toBe(true)
       |         ^
     34|     })
     35|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

The assertion compares the production payment with the worksheet's 110 through `withinTolerance` at an absolute tolerance of 1e-9; the mutated code pays 121 (the end-of-period reading) and misses by 11.

## Revert

The original bytes of `packages/engine/src/spending/abw.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/spending/abw.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
