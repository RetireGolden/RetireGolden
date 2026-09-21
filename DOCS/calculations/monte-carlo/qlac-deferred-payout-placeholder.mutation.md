# Mutation receipt: qlac-deferred-payout-placeholder

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/spiaQuotes.ts`

```diff
--- a/packages/engine/src/decisions/spiaQuotes.ts
+++ b/packages/engine/src/decisions/spiaQuotes.ts
@@ mutation @@
-export const QLAC_DEFERRED_PAYOUT_RATE = 0.16
+export const QLAC_DEFERRED_PAYOUT_RATE = 0.0016
```

Treats 0.16 as 0.16%, the worksheet's first wrong reading ($160 annually instead of $16,000).

## Command

```
npx vitest run src/decisions/spiaQuotes.evidence.test.ts
```

## Captured failing output

Captured with `NO_COLOR=1`; stdout precedes stderr, so the run summary appears before the failed-test detail. The `Start at` and `Duration` lines are the only lines removed.

```
 RUN  v5.0.0 C:/TEMP/rg-s3/packages/engine

 ❯ src/decisions/spiaQuotes.evidence.test.ts (5 tests | 2 failed) 5ms
   ❯ qlac-deferred-payout-placeholder — Temporary deferred-QLAC payout-rate placeholder (2)
     × the placeholder rate is 0.16 4ms
     × $100,000 of premium pays $16,000 annually, $1,333.33333333333 monthly 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)

(node:44672) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:43492) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/decisions/spiaQuotes.evidence.test.ts > qlac-deferred-payout-placeholder — Temporary deferred-QLAC payout-rate placeholder > the placeholder rate is 0.16
AssertionError: expected 0.0016 to be 0.16 // Object.is equality

- Expected
+ Received

- 0.16
+ 0.0016

 ❯ src/decisions/spiaQuotes.evidence.test.ts:20:41
     18|
     19|     it('the placeholder rate is 0.16', () => {
     20|       expect(QLAC_DEFERRED_PAYOUT_RATE).toBe(example.inputs.placeholde…
       |                                         ^
     21|     })
     22|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/decisions/spiaQuotes.evidence.test.ts > qlac-deferred-payout-placeholder — Temporary deferred-QLAC payout-rate placeholder > $100,000 of premium pays $16,000 annually, $1,333.33333333333 monthly
AssertionError: expected 160 to be 16000 // Object.is equality

- Expected
+ Received

- 16000
+ 160

 ❯ src/decisions/spiaQuotes.evidence.test.ts:26:22
     24|       const annual = premium * QLAC_DEFERRED_PAYOUT_RATE
     25|       const monthly = annual / 12
     26|       expect(annual).toBe(example.expected.annualPayout)
       |                      ^
     27|       expect(
     28|         withinTolerance(monthly, example.expected.monthlyPayout as num…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

`git checkout -- packages/engine/src/decisions/spiaQuotes.ts`, then `git diff --quiet -- packages/engine/src/decisions/spiaQuotes.ts` exited 0, confirming no change to production code after the run.
