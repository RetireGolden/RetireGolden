# Mutation receipt: ssdi-payable-months

Executed 2026-09-27 against RetireGolden base `ceb2799f` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet) for the new record under decision D-APPROX-FACTS, and re-executed 2026-09-27 against RetireGolden base `6628b1c8` (branch `claude/ssdi-month-and-roth-clock`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/disability.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/disability.ts b/packages/engine/src/socialSecurity/disability.ts
index a6229bdc..89776864 100644
--- a/packages/engine/src/socialSecurity/disability.ts
+++ b/packages/engine/src/socialSecurity/disability.ts
@@ -42,7 +42,7 @@ import {
  * consecutive calendar months ... throughout which the individual ... has been
  * under a disability".
  */
-export const SSDI_WAITING_PERIOD_MONTHS = 5
+export const SSDI_WAITING_PERIOD_MONTHS = 0
 
 /** The two disability facts a stream carries (`incomes[].disability`). */
 export interface SsdiOnset {
```

This removes the waiting period: a blank month is paid from January of the onset year, as the engine did until 2026-09-27 (the worksheet's first wrong reading), and a given month from the month after it.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/disability.payableMonths.evidence.test.ts
```

## Captured failing output

Re-executed for the independent review of decision D-APPROX-FACTS because its test file changed (the fall-through warning now names the person); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (disability.payableMonths.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine14/packages/engine

 ❯ src/socialSecurity/disability.payableMonths.evidence.test.ts (4 tests | 3 failed) 69ms
   ❯ ssdi-payable-months — SSDI months paid in a year, from the onset month (4)
     × the onset table: nothing for the five waiting months, the PIA from the sixth month after the onset month 42ms
     × the November 2036 onset: one disability month, then the automatic conversion at FRA (16,000 in 2037, 2,000 of it SSDI) 9ms
     × the December 2036 onset: no disability benefit, a warning, and the claim at 70 at the engine's claim-year convention (29,760 in 2040) 8ms

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/disability.payableMonths.evidence.test.ts > ssdi-payable-months — SSDI months paid in a year, from the onset month > the onset table: nothing for the five waiting months, the PIA from the sixth month after the onset month
AssertionError: Blank, 2030 24000 is not within 0.005 of the worksheet's 14000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/disability.payableMonths.evidence.test.ts:45:5
     43|     withinTolerance(actual, expected, { abs: 0.005 }),
     44|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     45|   ).toBe(true)
       |     ^
     46| }
     47|
 ❯ src/socialSecurity/disability.payableMonths.evidence.test.ts:79:9

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/socialSecurity/disability.payableMonths.evidence.test.ts > ssdi-payable-months — SSDI months paid in a year, from the onset month > the November 2036 onset: one disability month, then the automatic conversion at FRA (16,000 in 2037, 2,000 of it SSDI)
AssertionError: November 2037 24000 is not within 0.005 of the worksheet's 16000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/disability.payableMonths.evidence.test.ts:45:5
     43|     withinTolerance(actual, expected, { abs: 0.005 }),
     44|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     45|   ).toBe(true)
       |     ^
     46| }
     47|
 ❯ src/socialSecurity/disability.payableMonths.evidence.test.ts:88:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/socialSecurity/disability.payableMonths.evidence.test.ts > ssdi-payable-months — SSDI months paid in a year, from the onset month > the December 2036 onset: no disability benefit, a warning, and the claim at 70 at the engine's claim-year convention (29,760 in 2040)
AssertionError: December 2037 24000 is not within 0.005 of the worksheet's 0: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ expectWithin src/socialSecurity/disability.payableMonths.evidence.test.ts:45:5
     43|     withinTolerance(actual, expected, { abs: 0.005 }),
     44|     `${label} ${actual} is not within 0.005 of the worksheet's ${expec…
     45|   ).toBe(true)
       |     ^
     46| }
     47|
 ❯ src/socialSecurity/disability.payableMonths.evidence.test.ts:95:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/disability.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/disability.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
