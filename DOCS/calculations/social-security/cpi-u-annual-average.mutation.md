# Mutation receipt: cpi-u-annual-average

Executed 2026-09-27 against RetireGolden base `20b95c74` (branch `claude/b2p1-slice4-ss-models`; no pull request is open yet) in `packages/engine`.

## Mutation applied to `packages/engine/src/socialSecurity/cpiU.ts`

```diff
diff --git a/packages/engine/src/socialSecurity/cpiU.ts b/packages/engine/src/socialSecurity/cpiU.ts
index a947d4a4..c756c14c 100644
--- a/packages/engine/src/socialSecurity/cpiU.ts
+++ b/packages/engine/src/socialSecurity/cpiU.ts
@@ -20,7 +20,7 @@ export const CPI_U_ANNUAL_AVERAGE: Readonly<Record<number, number>> = {
   1945: 18,
   1946: 19.5,
   1947: 22.3,
-  1948: 24.1,
+  1948: 24,
   1949: 23.8,
   1950: 24.1,
   1951: 26,
```

This puts back the recomputed monthly mean for 1948 in place of BLS's published annual average, the worksheet's first wrong reading in one of its six years: the transcription check and the published-average check fail.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/socialSecurity/cpiU.evidence.test.ts
```

## Captured failing output

The baseline is green (cpiU.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine13/packages/engine

 ❯ src/socialSecurity/cpiU.evidence.test.ts (2 tests | 2 failed) 7ms
   ❯ cpi-u-annual-average — Consumer Price Index annual averages (2)
     × carries the annual average for every year 1937 to 2025, as the worksheet transcribes it 5ms
     × uses the published averages where a recomputed monthly mean differs (1948, 1952, 1953, 1959, 1962, 1966) 1ms

 Test Files  1 failed (1)
      Tests  2 failed (2)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/socialSecurity/cpiU.evidence.test.ts > cpi-u-annual-average — Consumer Price Index annual averages > carries the annual average for every year 1937 to 2025, as the worksheet transcribes it
AssertionError: expected [ '1948' ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "1948",
+ ]

 ❯ src/socialSecurity/cpiU.evidence.test.ts:32:48
     30|       expect(CPI_U_LATEST_YEAR).toBe(expected.latest)
     31|       const mismatches = [...rows].filter(([year, cells]) => CPI_U_ANN…
     32|       expect(mismatches.map(([year]) => year)).toEqual([])
       |                                                ^
     33|     })
     34|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/socialSecurity/cpiU.evidence.test.ts > cpi-u-annual-average — Consumer Price Index annual averages > uses the published averages where a recomputed monthly mean differs (1948, 1952, 1953, 1959, 1962, 1966)
AssertionError: expected [ 24, 26.5, 26.7, 29.1, 30.2, 32.4 ] to deeply equal [ 24.1, 26.5, 26.7, 29.1, 30.2, 32.4 ]

- Expected
+ Received

@@ -1,7 +1,7 @@
  [
-   24.1,
+   24,
    26.5,
    26.7,
    29.1,
    30.2,
    32.4,

 ❯ src/socialSecurity/cpiU.evidence.test.ts:36:94
     34|
     35|     it('uses the published averages where a recomputed monthly mean di…
     36|       expect([1948, 1952, 1953, 1959, 1962, 1966].map((year) => CPI_U_…
       |                                                                                              ^
     37|       expect(CPI_U_ANNUAL_AVERAGE[2024]).toBe(313.689)
     38|       expect(CPI_U_ANNUAL_AVERAGE[2025]).toBe(321.943)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Revert

The original bytes of `packages/engine/src/socialSecurity/cpiU.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/socialSecurity/cpiU.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
