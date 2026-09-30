# Mutation receipt: display-dollar-basis-conversion

Executed 2026-09-26 against RetireGolden base `7cf64e57` (branch `claude/b2p1-slice1-ledger-figures`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/dollarBasis.ts`

```diff
diff --git a/packages/engine/src/projection/dollarBasis.ts b/packages/engine/src/projection/dollarBasis.ts
index 0bf0f099..2d1e321e 100644
--- a/packages/engine/src/projection/dollarBasis.ts
+++ b/packages/engine/src/projection/dollarBasis.ts
@@ -120,4 +120,4 @@
 /** A nominal amount in `year`, in start-year dollars: `nominal / f(year)`. */
 export function toTodayDollars(basis: DollarBasis, year: number, nominal: number): number {
-  return nominal / inflationFactor(basis, year)
+  return nominal / inflationFactor(basis, year + 1)
 }
```

Divides by the next year's factor, the worksheet's off-by-one exponent (`y - s + 1`): 1,000,000 of 2036 then deflates to 762,144.78 instead of 781,198.40.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/dollarBasis.evidence.test.ts
```

## Captured failing output

The baseline is green (dollarBasis.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/projection/dollarBasis.evidence.test.ts (6 tests | 1 failed) 51ms
   ❯ display-dollar-basis-conversion — Today's dollars by the ledger's own inflation factor (6)
     × converts 1,000,000 to start-year dollars and back 3ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)



⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/dollarBasis.evidence.test.ts > display-dollar-basis-conversion — Today's dollars by the ledger's own inflation factor > converts 1,000,000 to start-year dollars and back
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/dollarBasis.evidence.test.ts:106:82
    104|       const amount = inputs.amount!
    105|       const today2036 = toTodayDollars(basis, 2036, amount)
    106|       expect(withinTolerance(today2036, expected.today2036!, example.t…
       |                                                                                  ^
    107|       expect(withinTolerance(toTodayDollars(basis, 2031, amount), expe…
    108|       expect(Math.abs(toNominalDollars(basis, 2036, today2036) - amoun…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/dollarBasis.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/dollarBasis.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
