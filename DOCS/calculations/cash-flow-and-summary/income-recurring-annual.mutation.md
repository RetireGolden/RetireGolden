# Mutation receipt: income-recurring-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729), and re-executed 2026-09-29 against RetireGolden base `aea4dac1` (branch `claude/2027-rollover`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/otherIncomeStreams.ts`

```diff
@@ -248,7 +248,7 @@ export function otherIncomeStreams(
   for (const stream of incomes) {
     if (stream.type === 'recurring') {
       if ((stream.startYear !== null && year < stream.startYear) || (stream.endYear !== null && year > stream.endYear)) continue
-      const amount = stream.annualAmount * (stream.inflationAdjusted ? inflFactor : 1)
+      const amount = stream.annualAmount
       rows.push({
         kind: 'recurring',
         amount,
```

This ignores the inflation election, publishing $12,000 — the worksheet's first wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/otherIncomeStreams.evidence.test.ts
```

## Captured failing output

Decision D-2027-ROLLOVER moved the lines these receipts quote (the per-publisher parameter split and the pre-start warnings in projection/simulate.ts and its annual phases, imports added to evidence files) and restated six of the records; the mutations are unchanged. The baseline is green (otherIncomeStreams.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine21/packages/engine

 ❯ src/projection/internal/otherIncomeStreams.evidence.test.ts (6 tests | 1 failed) 45ms
   ❯ income-recurring-annual — Annual recurring household income (2)
     × inflates a 12000 tax-free stream to 12960 inside its window 31ms

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)

             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/otherIncomeStreams.evidence.test.ts > income-recurring-annual — Annual recurring household income > inflates a 12000 tax-free stream to 12960 inside its window
AssertionError: recurring: actual 12000, worksheet 12960: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/otherIncomeStreams.evidence.test.ts:83:9
     81|         withinTolerance(year.incomes.recurring, expected.recurring!, e…
     82|         `recurring: actual ${year.incomes.recurring}, worksheet ${expe…
     83|       ).toBe(true)
       |         ^
     84|       // The worksheet's first wrong reading: ignoring the inflation e…
     85|       // The second: dropping a tax-free row from cash income entirely.

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/otherIncomeStreams.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/otherIncomeStreams.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
