# Mutation receipt: aime-zero-year-count

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/piaFromEarnings.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/piaFromEarnings.ts b/packages/engine/src/socialSecurity/piaFromEarnings.ts
index d90a5df9..1e4011f0 100644
--- a/packages/engine/src/socialSecurity/piaFromEarnings.ts
+++ b/packages/engine/src/socialSecurity/piaFromEarnings.ts
@@ -282,7 +282,7 @@ function computeWithReplacedYear(
     indexedYears: indexedDetails,
     yearsUsedInAime: top,
     computationYearCount,
-    zeroYearsInAime: top.filter((value) => value === 0).length,
+    zeroYearsInAime: annualIndexedList.filter((value) => value === 0).length,
     projectedYearCount,
     aime,
     piaMonthly: pia,
```

This counts every $0 base year, the dropped ones included, the worksheet's first wrong reading: case A reads 10 rather than 5 and case B 3 rather than 0.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/piaFromEarnings.zeroYearCount.evidence.test.ts
```

## Captured failing output

The baseline is green (piaFromEarnings.zeroYearCount.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed, and the checkout's path is written from the repository root. Exit code: 1.

```
RUN  v5.0.0 packages/engine

 ❯ src/socialSecurity/piaFromEarnings.zeroYearCount.evidence.test.ts (3 tests | 3 failed) 7ms
   ❯ aime-zero-year-count — Zero years in the averaged earnings (3)
     × case A: 5 of the 35 averaged years are $0 (not the 10 zero base years) 5ms
     × case B: three $0 base years, all dropped, so none averaged 1ms
     × case C: five earning years leave 30 averaged $0 years 0ms

 Test Files  1 failed (1)
      Tests  3 failed (3)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/piaFromEarnings.zeroYearCount.evidence.test.ts > aime-zero-year-count — Zero years in the averaged earnings > case A: 5 of the 35 averaged years are $0 (not the 10 zero base years)
AssertionError: expected [ 35, 10, 7487 ] to deeply equal [ 35, 5, 7487 ]

- Expected
+ Received

  [
    35,
-   5,
+   10,
    7487,
  ]

 ❯ src/socialSecurity/piaFromEarnings.zeroYearCount.evidence.test.ts:34:82
     32|     it('case A: 5 of the 35 averaged years are $0 (not the 10 zero bas…
     33|       const result = computed(1995, 2024)
     34|       expect([result.computationYearCount, result.zeroYearsInAime, res…
       |                                                                                  ^
     35|       expect(result.indexedYears.filter((row) => row.indexedAnnual ===…
     36|     })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/socialSecurity/piaFromEarnings.zeroYearCount.evidence.test.ts > aime-zero-year-count — Zero years in the averaged earnings > case B: three $0 base years, all dropped, so none averaged
AssertionError: expected [ 35, 3, 10028 ] to deeply equal [ 35, +0, 10028 ]

- Expected
+ Received

  [
    35,
-   0,
+   3,
    10028,
  ]

 ❯ src/socialSecurity/piaFromEarnings.zeroYearCount.evidence.test.ts:40:82
     38|     it('case B: three $0 base years, all dropped, so none averaged', (…
     39|       const result = computed(1988, 2024)
     40|       expect([result.computationYearCount, result.zeroYearsInAime, res…
       |                                                                                  ^
     41|     })
     42|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/socialSecurity/piaFromEarnings.zeroYearCount.evidence.test.ts > aime-zero-year-count — Zero years in the averaged earnings > case C: five earning years leave 30 averaged $0 years
AssertionError: expected [ 35, 35, 793 ] to deeply equal [ 35, 30, 793 ]

- Expected
+ Received

  [
    35,
-   30,
+   35,
    793,
  ]

 ❯ src/socialSecurity/piaFromEarnings.zeroYearCount.evidence.test.ts:45:82
     43|     it('case C: five earning years leave 30 averaged $0 years', () => {
     44|       const result = computed(2020, 2024)
     45|       expect([result.computationYearCount, result.zeroYearsInAime, res…
       |                                                                                  ^
     46|     })
     47|   },

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/piaFromEarnings.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/piaFromEarnings.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
