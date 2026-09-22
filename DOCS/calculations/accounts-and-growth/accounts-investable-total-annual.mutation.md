# Mutation receipt: accounts-investable-total-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/annualSnapshot.ts`

```diff
@@ -112,6 +112,7 @@ export function annualSnapshot(input: AnnualSnapshotInput): AnnualSnapshot {
   for (const [id, value] of insuranceCashValues) {
     balanceEntries.push([id, value])
     insuranceCashValueTotal += value
+    investableTotal += value
   }
 
   return {
```

This folds permanent-life cash value into the investable total, publishing $604,000 — the worksheet's second wrong reading.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/annualSnapshot.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (annualSnapshot.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/annualSnapshot.evidence.test.ts (2 tests | 2 failed) 31ms
   ❯ accounts-investable-total-annual — Annual investable total (2)
     × folds the seven investable members to 592000 and leaves the other three channels out 4ms
     × publishes the same member list on a real projection, excluding policy cash value and property 26ms

 Test Files  1 failed (1)
      Tests  2 failed (2)

  Transform  transforming modules took 2.19s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/annualSnapshot.evidence.test.ts > accounts-investable-total-annual — Annual investable total > folds the seven investable members to 592000 and leaves the other three channels out
AssertionError: investableTotal: actual 604000, worksheet 592000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/annualSnapshot.evidence.test.ts:77:9
     75|         withinTolerance(snapshot.investableTotal, expected.investableT…
     76|         `investableTotal: actual ${snapshot.investableTotal}, workshee…
     77|       ).toBe(true)
       |         ^
     78|       // Insurance cash value is folded into its own channel, not this…
     79|       expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/projection/internal/annualSnapshot.evidence.test.ts > accounts-investable-total-annual — Annual investable total > publishes the same member list on a real projection, excluding policy cash value and property
AssertionError: investableTotal: actual 602000, six worksheet members 590000: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/annualSnapshot.evidence.test.ts:130:9
    128|         withinTolerance(row.investableTotal, sixMembers, example.toler…
    129|         `investableTotal: actual ${row.investableTotal}, six worksheet…
    130|       ).toBe(true)
       |         ^
    131|       expect(
    132|         withinTolerance(row.investableTotal, expected.investableTotal!…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/annualSnapshot.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/annualSnapshot.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
