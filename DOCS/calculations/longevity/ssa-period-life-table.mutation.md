# Mutation receipt: ssa-period-life-table

Executed 2026-09-28 against RetireGolden base `2a93de55` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `476abd6e` (branch `claude/life-table-2023`; no pull request is open yet), and re-executed 2026-09-28 against RetireGolden base `b8927e7e` (branch `claude/life-table-2023`, pull request #759) in `packages/engine`.

## Mutation applied to `packages/engine/src/longevity/ssaPeriodLifeTable.ts`

```diff
@@ -92,7 +92,7 @@
       /* 30 */ 0.002085, 0.002202, 0.002308, 0.002407, 0.002490, 0.002577, 0.002665, 0.002764, 0.002864, 0.002987,
       /* 40 */ 0.003115, 0.003253, 0.003419, 0.003600, 0.003777, 0.003931, 0.004073, 0.004245, 0.004477, 0.004795,
       /* 50 */ 0.005126, 0.005496, 0.005917, 0.006404, 0.006923, 0.007491, 0.008173, 0.008938, 0.009714, 0.010494,
-      /* 60 */ 0.011337, 0.012232, 0.013196, 0.014229, 0.015316, 0.016455, 0.017574, 0.018735, 0.019981, 0.021366,
+      /* 60 */ 0.011337, 0.012232, 0.013196, 0.014229, 0.015316, 0.016456, 0.017574, 0.018735, 0.019981, 0.021366,
       /* 70 */ 0.022903, 0.024615, 0.026504, 0.028648, 0.031071, 0.033802, 0.037010, 0.041158, 0.045461, 0.050346,
       /* 80 */ 0.055633, 0.061757, 0.068358, 0.075420, 0.083364, 0.092680, 0.103459, 0.115502, 0.129018, 0.143810,
       /* 90 */ 0.159458, 0.176551, 0.195360, 0.216286, 0.238799, 0.262268, 0.286291, 0.310944, 0.332325, 0.349036,
```

This changes one digit of one cell, the male q(65), 0.016455 to 0.016456: a transcription error of the kind the worksheet's cell-by-cell comparison exists to catch. The cell comparison names the row, the rebuilt SHA-256 no longer equals the source record's `columnsSha256`, and the quoted row 65 no longer reads 0.016455.

## Command

```
NO_COLOR=1 FORCE_COLOR=0 node node_modules/vitest/vitest.mjs run src/longevity/ssaPeriodLifeTable.evidence.test.ts
```

## Captured failing output

Re-executed after the PR #759 review fixes: a non-finite age now throws first in sampleDeathAge, jointLastSurvivorExpectancy and hazardForExpectancyMultiplier (review 5), the table module gained the known editions and the published curve gap (reviews 7 and 8), and the provenance catalog gained the 2022 edition (review 1), which moved the lines, test titles and counts these receipts quote. The baseline is green (ssaPeriodLifeTable.evidence.test.ts passes on unmodified production, exit 0). Captured with `NO_COLOR=1` and `FORCE_COLOR=0`; stdout precedes stderr. Start time, duration and module-transform timing lines were removed. Exit code: 1.

```
RUN  v5.0.0 C:/rgwt/engine15/packages/engine

 ❯ src/longevity/ssaPeriodLifeTable.evidence.test.ts (6 tests | 3 failed) 13ms
   ❯ ssa-period-life-table — SSA period life table, 2023 (2026 Trustees Report) (6)
     × carries SSA's q and e for both sexes at every age 0 to 119, cell for cell as the worksheet transcribes the page 6ms
     × rebuilds the columns' SHA-256 from the numbers: toFixed(6) and toFixed(2) give back the printed strings 5ms
     × prints the rows the records quote: 65 is 0.016455 / 18.12 / 0.010188 / 20.66, and 119 is 0.926604 / 0.58 for both sexes 1ms

 Test Files  1 failed (1)
      Tests  3 failed | 3 passed (6)


⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/longevity/ssaPeriodLifeTable.evidence.test.ts > ssa-period-life-table — SSA period life table, 2023 (2026 Trustees Report) > carries SSA's q and e for both sexes at every age 0 to 119, cell for cell as the worksheet transcribes the page
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "65: 0.016456, 18.12, 0.010188, 20.66 against 0.016455, 18.12, 0.010188, 20.66",
+ ]

 ❯ src/longevity/ssaPeriodLifeTable.evidence.test.ts:61:26
     59|         if (table.some((value, i) => value !== sheet[i])) mismatches.p…
     60|       }
     61|       expect(mismatches).toEqual([])
       |                          ^
     62|     })
     63|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 FAIL  src/longevity/ssaPeriodLifeTable.evidence.test.ts > ssa-period-life-table — SSA period life table, 2023 (2026 Trustees Report) > rebuilds the columns' SHA-256 from the numbers: toFixed(6) and toFixed(2) give back the printed strings
AssertionError: expected 'ccaac424f362e772f5e11eb5687254305d9ad…' to be '32e6a4c36584ea44d7778c48397c8650d8822…' // Object.is equality

Expected: "32e6a4c36584ea44d7778c48397c8650d882288cb1bcb6f9861edfd8c3acfe4c"
Received: "ccaac424f362e772f5e11eb5687254305d9ad9818a9aba8920ee21346ee345ed"

 ❯ src/longevity/ssaPeriodLifeTable.evidence.test.ts:69:37
     67|         text += `${x},${male.q[x]!.toFixed(6)},${male.e[x]!.toFixed(2)…
     68|       }
     69|       expect(await sha256Hex(text)).toBe(source.columnsSha256)
       |                                     ^
     70|       // The same text is what the worksheet's Expected table prints, …
     71|       for (const [age, cells] of rows) {

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯

 FAIL  src/longevity/ssaPeriodLifeTable.evidence.test.ts > ssa-period-life-table — SSA period life table, 2023 (2026 Trustees Report) > prints the rows the records quote: 65 is 0.016455 / 18.12 / 0.010188 / 20.66, and 119 is 0.926604 / 0.58 for both sexes
AssertionError: expected [ 0.016456, 18.12, 0.010188, 20.66 ] to deeply equal [ 0.016455, 18.12, 0.010188, 20.66 ]

- Expected
+ Received

  [
-   0.016455,
+   0.016456,
    18.12,
    0.010188,
    20.66,
  ]

 ❯ src/longevity/ssaPeriodLifeTable.evidence.test.ts:78:68
     76|
     77|     it('prints the rows the records quote: 65 is 0.016455 / 18.12 / 0.…
     78|       expect([male.q[65], male.e[65], female.q[65], female.e[65]]).toE…
       |                                                                    ^
     79|       expect([male.q[119], male.e[119], female.q[119], female.e[119]])…
     80|       expect(LAST_TABLE_AGE).toBe(expected.lastAge)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Revert

The original bytes of `packages/engine/src/longevity/ssaPeriodLifeTable.ts` were written back and compared byte for byte in the harness, and `git diff --quiet -- packages/engine/src/longevity/ssaPeriodLifeTable.ts` then exited 0, confirming no production change remained. Re-ran the named command after restoration: the suite returned to its baseline state, green (exit 0).
