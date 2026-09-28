# Mutation receipt: zero-year-replacement-gain

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `df4b4cbf` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/piaFromEarnings.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/piaFromEarnings.ts b/packages/engine/src/socialSecurity/piaFromEarnings.ts
index 2e637f4f..47aab868 100644
--- a/packages/engine/src/socialSecurity/piaFromEarnings.ts
+++ b/packages/engine/src/socialSecurity/piaFromEarnings.ts
@@ -523,7 +523,7 @@ export function zeroYearReplacementGain(input: PiaFromEarningsInput, amount: num
   const before = computePiaFromEarnings(input)
   if (isPiaFromEarningsError(before) || before.zeroYearsInAime === 0) return null
   let year: number | null = null
-  for (const row of before.indexedYears) if (row.rawEarnings === 0) year = row.year
+  for (const row of before.indexedYears) if (row.rawEarnings === 0 && year === null) year = row.year
   if (year === null) return null
   const after = computeWithReplacedYear(input, { year, amount })
   if (isPiaFromEarningsError(after)) return null
```

This replaces the earliest $0 base year, 1988, rather than the latest, the worksheet's last wrong reading: the sample is capped at 1988's base and wage-indexed, so every case's replaced year and gain miss the worksheet's.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts
```

## Captured failing output

The slice's review fixes moved the lines around its hunk, renamed its module or changed its test file, so it is re-executed on the current code. The baseline is green (piaFromEarnings.zeroYear.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine13/packages/engine

 ❯ src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts (5 tests | 4 failed) 7ms
   ❯ zero-year-replacement-gain — PIA gain from replacing a year with no earnings (5)
     × case A: 2027 at $60,000, unindexed, adds $45.70 (3,141.70 to 3,187.40) 4ms
     × case B: $300,000 is capped at the base and crosses the second bend point: $110.40, not $228.57 0ms
     × case C: above the second bend point the capped year adds $66.00 0ms
     × case O: past 61 the latest $0 year, 2019, has passed; its 17.90 for 2020 is 22.50 in 2026 dollars 0ms

 Test Files  1 failed (1)
      Tests  4 failed | 1 passed (5)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts > zero-year-replacement-gain — PIA gain from replacing a year with no earnings > case A: 2027 at $60,000, unindexed, adds $45.70 (3,141.70 to 3,187.40)
AssertionError: expected 1988 to be 2027 // Object.is equality

- Expected
+ Received

- 2027
+ 1988

 ❯ expectGain src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts:23:21
     21|   const gain = zeroYearReplacementGain(input, amount, asOf2026)!
     22|   const dime = { abs: 1e-9 }
     23|   expect(gain.year).toBe(cell(label, 0))
       |                     ^
     24|   expect(gain.amount).toBe(amount)
     25|   expect(withinTolerance(gain.piaBefore, cell(label, 1), dime), `${lab…
 ❯ src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts:44:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts > zero-year-replacement-gain — PIA gain from replacing a year with no earnings > case B: $300,000 is capped at the base and crosses the second bend point: $110.40, not $228.57
AssertionError: expected 1988 to be 2027 // Object.is equality

- Expected
+ Received

- 2027
+ 1988

 ❯ expectGain src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts:23:21
     21|   const gain = zeroYearReplacementGain(input, amount, asOf2026)!
     22|   const dime = { abs: 1e-9 }
     23|   expect(gain.year).toBe(cell(label, 0))
       |                     ^
     24|   expect(gain.amount).toBe(amount)
     25|   expect(withinTolerance(gain.piaBefore, cell(label, 1), dime), `${lab…
 ❯ src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts:48:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts > zero-year-replacement-gain — PIA gain from replacing a year with no earnings > case C: above the second bend point the capped year adds $66.00
AssertionError: expected 1988 to be 2027 // Object.is equality

- Expected
+ Received

- 2027
+ 1988

 ❯ expectGain src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts:23:21
     21|   const gain = zeroYearReplacementGain(input, amount, asOf2026)!
     22|   const dime = { abs: 1e-9 }
     23|   expect(gain.year).toBe(cell(label, 0))
       |                     ^
     24|   expect(gain.amount).toBe(amount)
     25|   expect(withinTolerance(gain.piaBefore, cell(label, 1), dime), `${lab…
 ❯ src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts:53:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts > zero-year-replacement-gain — PIA gain from replacing a year with no earnings > case O: past 61 the latest $0 year, 2019, has passed; its 17.90 for 2020 is 22.50 in 2026 dollars
AssertionError: expected 1980 to be 2019 // Object.is equality

- Expected
+ Received

- 2019
+ 1980

 ❯ expectGain src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts:23:21
     21|   const gain = zeroYearReplacementGain(input, amount, asOf2026)!
     22|   const dime = { abs: 1e-9 }
     23|   expect(gain.year).toBe(cell(label, 0))
       |                     ^
     24|   expect(gain.amount).toBe(amount)
     25|   expect(withinTolerance(gain.piaBefore, cell(label, 1), dime), `${lab…
 ❯ src/socialSecurity/piaFromEarnings.zeroYear.evidence.test.ts:57:7

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/piaFromEarnings.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/piaFromEarnings.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
