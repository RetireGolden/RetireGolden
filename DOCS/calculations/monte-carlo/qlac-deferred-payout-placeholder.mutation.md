# Mutation receipt: qlac-deferred-payout-placeholder

Executed 2026-09-17 against RetireGolden base `33e7d546` (branch grok/b1-p4-cards-monte-carlo), and re-executed 2026-09-27 against RetireGolden base `7d1a6225` (branch `claude/receipt-drift`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/decisions/spiaQuotes.ts`

```diff
diff --git a/packages/engine/src/decisions/spiaQuotes.ts b/packages/engine/src/decisions/spiaQuotes.ts
index a076dfeb..033852ab 100644
--- a/packages/engine/src/decisions/spiaQuotes.ts
+++ b/packages/engine/src/decisions/spiaQuotes.ts
@@ -61,4 +61,4 @@ export function spiaPayoutRate(startAge: number): number {
  * deferred rate is a HARD item for the next parameter-pack refresh
  * (DOCS/maintenance-schedule.md), not a nice-to-have.
  */
-export const QLAC_DEFERRED_PAYOUT_RATE = 0.16
+export const QLAC_DEFERRED_PAYOUT_RATE = 0.0016
```

Treats 0.16 as 0.16%, the worksheet's first wrong reading ($160 annually instead of $16,000).

## Command

```
npx vitest run src/decisions/spiaQuotes.evidence.test.ts
```

## Captured failing output

Re-executed for D-RECEIPT-DRIFT because its diff was a text substitution that named no line (it is now the git diff of the same substitution); the mutation is unchanged, and the capture, blob hashes and revert note are refreshed against this head. The baseline is green (spiaQuotes.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine9/packages/engine

 ❯ src/decisions/spiaQuotes.evidence.test.ts (5 tests | 2 failed) 6ms
   ❯ qlac-deferred-payout-placeholder — Temporary deferred-QLAC payout-rate placeholder (2)
     × the placeholder rate is 0.16 4ms
     × $100,000 of premium pays $16,000 annually, $1,333.33333333333 monthly 0ms

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)


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

The original bytes of `packages/engine/src/decisions/spiaQuotes.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/decisions/spiaQuotes.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
