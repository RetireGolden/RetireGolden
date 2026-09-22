# Mutation receipt: income-wages-annual

Executed 2026-09-18 on branch `claude/b1-p4-cards-slice-nine` at base `39f8f460`, and re-executed 2026-09-22 against RetireGolden base `4fe87f00` (branch `claude/b1-p4-cards-nine-ten`, pull request #729) in `packages/engine`.

## Mutation applied to `packages/engine/src/projection/internal/wageIncomeStreams.ts`

```diff
@@ -265,7 +265,7 @@ export function wageIncomeStreams(input: WageIncomeYearInput): readonly WageInco
     const stopAge = stream.endAge ?? person.retirementAge
     if (!s.alive || (stopAge !== null && s.ageAttained >= stopAge)) continue
     const raiseFactor = Math.pow(1 + (stream.realGrowthPct ?? 0) / 100, year - startYear)
-    const amount = stream.annualGross * raiseFactor * inflFactor
+    const amount = stream.annualGross * inflFactor
     rows.push({
       personId: stream.personId,
       amount,
```

This drops the real-raise factor, publishing $86,400 — the worksheet's first wrong reading, inflation without the raise.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/projection/internal/wageIncomeStreams.evidence.test.ts
```

## Captured failing output

Re-executed 2026-09-22 on the pull-request branch after the review of #729: the branch was renamed for the pull request and several fixtures changed, so every capture, blob hash and revert note is refreshed against this head. The baseline is green (wageIncomeStreams.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time and duration lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/TEMP/rg-rehearse2/packages/engine

 ❯ src/projection/internal/wageIncomeStreams.evidence.test.ts (2 tests | 1 failed) 33ms
   ❯ income-wages-annual — Annual wage income for one stream (2)
     × pays 89890.56 at age 64, two real raises and the 1.08 inflation factor 28ms

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)

  Transform  transforming modules took 2.17s · 44% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/projection/internal/wageIncomeStreams.evidence.test.ts > income-wages-annual — Annual wage income for one stream > pays 89890.56 at age 64, two real raises and the 1.08 inflation factor
AssertionError: wages: actual 86400, worksheet 89890.56: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/projection/internal/wageIncomeStreams.evidence.test.ts:97:9
     95|         withinTolerance(year.incomes.wages, expected.wages!, example.t…
     96|         `wages: actual ${year.incomes.wages}, worksheet ${expected.wag…
     97|       ).toBe(true)
       |         ^
     98|       // The worksheet's first wrong reading: inflation without the re…
     99|       expect(

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Revert

The original bytes of `packages/engine/src/projection/internal/wageIncomeStreams.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/projection/internal/wageIncomeStreams.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
