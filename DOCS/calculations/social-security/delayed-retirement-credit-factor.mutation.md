# Mutation receipt: delayed-retirement-credit-factor

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-eight` at base `989fc81b`, and re-executed 2026-09-22 against RetireGolden base `a046c8f0` (branch `claude/b1-p4-cards-eight`, pull request #728), and re-executed 2026-09-27 against RetireGolden base `d9447bec` (branch `claude/aca-2027-coverage-year`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/benefitFactor.ts`

```diff
@@ -50,7 +50,7 @@ export function delayedCreditMonthlyPct(effectiveBirthYear: number): number {
 export function delayedRetirementFactor(
   monthsAfterFra: number,
   maxMonthsAfterFraToAge70: number,
-  monthlyPct = 2 / 3,
+  monthlyPct = 5 / 9,
 ): number {
   if (monthsAfterFra <= 0) return 1
   const d = Math.min(monthsAfterFra, Math.max(0, maxMonthsAfterFraToAge70))
```

This credits delayed months at the early-claim 5/9-of-1% rate, publishing a factor of 1.1333..., the worksheet's second wrong reading. It changes the default monthly credit of `delayedRetirementFactor`, which the evidence calls without a rate: #744 replaced the literal `2 / 3` in the formula with that default (the 20 CFR 404.313(b)(2) rate for births after January 1, 1943, with `delayedCreditMonthlyPct` for earlier births), so the original anchor no longer exists and the receipt was re-anchored on the default, an equivalent mutation.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/benefitFactor.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-27 for the review of decision D-ACA-2027-TABLE: #744 removed the original anchor (the delayed credit became a rate by birth date, and the 2/3 of 1 percent a default parameter), so the receipt was re-anchored on that default with the equivalent mutation described above. The baseline is green (benefitFactor.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine7/packages/engine

 ❯ src/socialSecurity/benefitFactor.evidence.test.ts (7 tests | 1 failed) 6ms
   ❯ delayed-retirement-credit-factor — Delayed retirement credit factor (4)
     × credits 24 months at 2/3 of 1% for a factor of 1.16 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/benefitFactor.evidence.test.ts > delayed-retirement-credit-factor — Delayed retirement credit factor > credits 24 months at 2/3 of 1% for a factor of 1.16
AssertionError: factor 1.1333333333333333 is not within {"abs":1e-12} of the worksheet's 1.16: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/benefitFactor.evidence.test.ts:15:5
     13|     withinTolerance(actual, expected, tolerance),
     14|     `${label} ${actual} is not within ${JSON.stringify(tolerance)} of …
     15|   ).toBe(true)
       |     ^
     16| }
     17|
 ❯ src/socialSecurity/benefitFactor.evidence.test.ts:35:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/benefitFactor.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/benefitFactor.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
