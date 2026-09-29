# Mutation receipt: income-one-time-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-29 against RetireGolden base `aea4dac1` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/otherIncomeStreams.ts`

```diff
@@ -261,7 +261,7 @@ export function otherIncomeStreams(
       })
     } else if (stream.type === 'oneTime') {
       if (stream.year !== year) continue
-      const amount = stream.amount * (stream.inflationAdjusted ? inflFactor : 1)
+      const amount = stream.amount
       rows.push({
         kind: 'oneTime',
         amount,
```

This treats the amount as already nominal, publishing $50,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/otherIncomeStreams.evidence.test.ts
```

## Captured failing output

Decision D-2027-ROLLOVER moved the lines these receipts quote (the per-publisher parameter split and the pre-start warnings in projection/simulate.ts and its annual phases, imports added to evidence files) and restated six of the records; the mutations are unchanged. The baseline is green (otherIncomeStreams.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine21/packages/engine

 ❯ src/projection/internal/otherIncomeStreams.evidence.test.ts (6 tests | 1 failed) 66ms
   ❯ income-one-time-annual — Annual one-time income (2)
     × inflates a 50000 capital-gain payment to 56000 in its named year 14ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/otherIncomeStreams.evidence.test.ts > income-one-time-annual — Annual one-time income > inflates a 50000 capital-gain payment to 56000 in its named year
AssertionError: oneTime: actual 50000, worksheet 56000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/otherIncomeStreams.evidence.test.ts:159:9
    157|         withinTolerance(year.incomes.oneTime, expected.oneTime!, examp…
    158|         `oneTime: actual ${year.incomes.oneTime}, worksheet ${expected…
    159|       ).toBe(true)
       |         ^
    160|       // The worksheet's first wrong reading: treating the amount as a…
    161|       // nominal. The third: treating capital-gain character as exclus…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/otherIncomeStreams.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/otherIncomeStreams.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
