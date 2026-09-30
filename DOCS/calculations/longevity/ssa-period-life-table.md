## Claim

Kind: data. `longevity/ssaPeriodLifeTable.ts#SSA_PERIOD_LIFE_TABLE` carries SSA's Table 4C6 period life table for 2023, as used in the 2026 Trustees Report: the probability of dying within one year, q(x), and the period life expectancy, e(x), at each exact age x from 0 to 119, for men and for women, as printed (q to six decimals, e to two), read from SSA's page on 2026-09-27. `montecarlo/mortality.ts#annualMortality` reads q (`mortality-published-death-probability`); `#baselineRemainingYears` reads e, the longevity questionnaire's baseline.

New 2026-09-27 (decision D-LIFE-TABLE-2023). It replaces `longevity/ssaPeriod2022.ts`, which carried only the e(x) columns of the 2022 period table (2025 Trustees Report), from which the engine rebuilt q(x) by the half-year identity (the retired record `mortality-ex-to-qx-identity`).

## Justification

SSA, Office of the Chief Actuary, "Actuarial Life Table" (https://www.ssa.gov/oact/STATS/table4c6.html), read in a browser on 2026-09-27 (ssa.gov refuses non-browser clients): "Here we present the 2023 period life table for the Social Security area population, as used in the 2026 Trustees Report (TR)." The table's caption is "Period Life Table, 2023, as used in the 2026 Trustees Report". Its column notes read "Probability of dying within one year." and "Number of survivors out of 100,000 born alive.", and the note under the table reads: "The period life expectancy at a given age for 2023 is the average remaining number of years expected prior to death for a person at that exact age, born on January 1, using the mortality rates for 2023 over the course of their remaining life." The page prints 120 rows, ages 0 to 119, and no row 120.

No statute governs a planning life table. SSA's own published table is the governing source, and the engine carries it as printed, with the stated departure at the last row (`mortality-published-death-probability`).

## Inputs

The page's table, read three ways by the derivation and its independent check, with 0 mismatches over every cell:

- the live page, read cell by cell in a browser on 2026-09-27; the seven columns saved as CSV (header line `age,qM,lM,eM,qF,lF,eF`, one newline-terminated line per row, thousands separators removed) hash to SHA-256 `d305bbbd6c6463d5b3144a4cdaa49a9b99c010a767e93f908bc96bfa3a533230`;
- the Internet Archive capture of the page, https://web.archive.org/web/20260922113934/https://www.ssa.gov/oact/STATS/table4c6.html (captured 2026-09-22 11:39:34 UTC; `https://web.archive.org/web/20260922113934id_/https://www.ssa.gov/oact/STATS/table4c6.html` serves the capture's own bytes, without the archive's banner);
- the independent check's own live read of the same day.

## Arithmetic

None: a transcription of four columns (male q, male e, female q, female e). The number-of-lives columns are not carried.

The canonical text of the four columns is the line `age,qM,eM,qF,eF`, then one line per age x = 0..119 with x, the male q to six decimals, the male e to two, the female q to six and the female e to two, comma-separated, every line newline-terminated. Its SHA-256 is `32e6a4c36584ea44d7778c48397c8650d882288cb1bcb6f9861edfd8c3acfe4c`, and the source record carries it as `columnsSha256`. Because every q is printed to six decimals and every e to two, `toFixed(6)` and `toFixed(2)` of the stored numbers give back the printed strings, so the evidence rebuilds the hash from the numbers alone.

Rows quoted elsewhere: at 65, men 0.016455 and 18.12, women 0.010188 and 20.66; at 119, both sexes 0.926604 and 0.58 (the 2022 table printed 1.000000 and 0.50 there).

## Expected

SSA Table 4C6, period life table 2023, as used in the 2026 Trustees Report; read at https://www.ssa.gov/oact/STATS/table4c6.html on 2026-09-27 (SHA-256 of the seven-column read saved as CSV with a header line age,qM,lM,eM,qF,lF,eF: d305bbbd6c6463d5b3144a4cdaa49a9b99c010a767e93f908bc96bfa3a533230). The number-of-lives columns are not carried here.

| Exact age | Male q(x) | Male e(x) | Female q(x) | Female e(x) |
|---:|---:|---:|---:|---:|
| 0 | 0.006015 | 75.79 | 0.005125 | 81.06 |
| 1 | 0.000479 | 75.25 | 0.000392 | 80.48 |
| 2 | 0.000320 | 74.28 | 0.000229 | 79.51 |
| 3 | 0.000249 | 73.31 | 0.000188 | 78.53 |
| 4 | 0.000194 | 72.33 | 0.000155 | 77.54 |
| 5 | 0.000159 | 71.34 | 0.000133 | 76.55 |
| 6 | 0.000137 | 70.35 | 0.000115 | 75.56 |
| 7 | 0.000125 | 69.36 | 0.000105 | 74.57 |
| 8 | 0.000120 | 68.37 | 0.000100 | 73.58 |
| 9 | 0.000120 | 67.38 | 0.000098 | 72.59 |
| 10 | 0.000125 | 66.39 | 0.000101 | 71.59 |
| 11 | 0.000140 | 65.39 | 0.000111 | 70.60 |
| 12 | 0.000173 | 64.40 | 0.000126 | 69.61 |
| 13 | 0.000233 | 63.41 | 0.000152 | 68.62 |
| 14 | 0.000327 | 62.43 | 0.000188 | 67.63 |
| 15 | 0.000463 | 61.45 | 0.000229 | 66.64 |
| 16 | 0.000634 | 60.48 | 0.000273 | 65.66 |
| 17 | 0.000819 | 59.51 | 0.000323 | 64.67 |
| 18 | 0.000999 | 58.56 | 0.000372 | 63.69 |
| 19 | 0.001138 | 57.62 | 0.000410 | 62.72 |
| 20 | 0.001235 | 56.69 | 0.000441 | 61.74 |
| 21 | 0.001315 | 55.76 | 0.000476 | 60.77 |
| 22 | 0.001378 | 54.83 | 0.000513 | 59.80 |
| 23 | 0.001439 | 53.90 | 0.000546 | 58.83 |
| 24 | 0.001509 | 52.98 | 0.000582 | 57.86 |
| 25 | 0.001595 | 52.06 | 0.000609 | 56.90 |
| 26 | 0.001685 | 51.14 | 0.000641 | 55.93 |
| 27 | 0.001783 | 50.23 | 0.000683 | 54.97 |
| 28 | 0.001876 | 49.32 | 0.000740 | 54.00 |
| 29 | 0.001970 | 48.41 | 0.000808 | 53.04 |
| 30 | 0.002085 | 47.50 | 0.000878 | 52.08 |
| 31 | 0.002202 | 46.60 | 0.000947 | 51.13 |
| 32 | 0.002308 | 45.70 | 0.001018 | 50.18 |
| 33 | 0.002407 | 44.81 | 0.001089 | 49.23 |
| 34 | 0.002490 | 43.91 | 0.001154 | 48.28 |
| 35 | 0.002577 | 43.02 | 0.001209 | 47.34 |
| 36 | 0.002665 | 42.13 | 0.001263 | 46.39 |
| 37 | 0.002764 | 41.24 | 0.001347 | 45.45 |
| 38 | 0.002864 | 40.36 | 0.001438 | 44.51 |
| 39 | 0.002987 | 39.47 | 0.001533 | 43.58 |
| 40 | 0.003115 | 38.59 | 0.001643 | 42.64 |
| 41 | 0.003253 | 37.71 | 0.001742 | 41.71 |
| 42 | 0.003419 | 36.83 | 0.001845 | 40.78 |
| 43 | 0.003600 | 35.95 | 0.001954 | 39.86 |
| 44 | 0.003777 | 35.08 | 0.002075 | 38.93 |
| 45 | 0.003931 | 34.21 | 0.002187 | 38.01 |
| 46 | 0.004073 | 33.34 | 0.002306 | 37.10 |
| 47 | 0.004245 | 32.48 | 0.002438 | 36.18 |
| 48 | 0.004477 | 31.62 | 0.002595 | 35.27 |
| 49 | 0.004795 | 30.76 | 0.002791 | 34.36 |
| 50 | 0.005126 | 29.90 | 0.003030 | 33.45 |
| 51 | 0.005496 | 29.05 | 0.003288 | 32.55 |
| 52 | 0.005917 | 28.21 | 0.003554 | 31.66 |
| 53 | 0.006404 | 27.38 | 0.003847 | 30.77 |
| 54 | 0.006923 | 26.55 | 0.004172 | 29.89 |
| 55 | 0.007491 | 25.73 | 0.004532 | 29.01 |
| 56 | 0.008173 | 24.92 | 0.004923 | 28.14 |
| 57 | 0.008938 | 24.12 | 0.005365 | 27.28 |
| 58 | 0.009714 | 23.34 | 0.005815 | 26.42 |
| 59 | 0.010494 | 22.56 | 0.006333 | 25.57 |
| 60 | 0.011337 | 21.79 | 0.006923 | 24.73 |
| 61 | 0.012232 | 21.04 | 0.007555 | 23.90 |
| 62 | 0.013196 | 20.29 | 0.008220 | 23.08 |
| 63 | 0.014229 | 19.56 | 0.008881 | 22.27 |
| 64 | 0.015316 | 18.83 | 0.009514 | 21.46 |
| 65 | 0.016455 | 18.12 | 0.010188 | 20.66 |
| 66 | 0.017574 | 17.41 | 0.010880 | 19.87 |
| 67 | 0.018735 | 16.71 | 0.011659 | 19.08 |
| 68 | 0.019981 | 16.02 | 0.012543 | 18.30 |
| 69 | 0.021366 | 15.34 | 0.013581 | 17.53 |
| 70 | 0.022903 | 14.66 | 0.014769 | 16.76 |
| 71 | 0.024615 | 14.00 | 0.016153 | 16.01 |
| 72 | 0.026504 | 13.34 | 0.017705 | 15.26 |
| 73 | 0.028648 | 12.69 | 0.019495 | 14.53 |
| 74 | 0.031071 | 12.05 | 0.021533 | 13.81 |
| 75 | 0.033802 | 11.42 | 0.023846 | 13.10 |
| 76 | 0.037010 | 10.80 | 0.026458 | 12.41 |
| 77 | 0.041158 | 10.19 | 0.029700 | 11.73 |
| 78 | 0.045461 | 9.61 | 0.033135 | 11.08 |
| 79 | 0.050346 | 9.04 | 0.036982 | 10.44 |
| 80 | 0.055633 | 8.50 | 0.041183 | 9.82 |
| 81 | 0.061757 | 7.97 | 0.045959 | 9.22 |
| 82 | 0.068358 | 7.46 | 0.051282 | 8.64 |
| 83 | 0.075420 | 6.97 | 0.057262 | 8.08 |
| 84 | 0.083364 | 6.50 | 0.064107 | 7.54 |
| 85 | 0.092680 | 6.04 | 0.071752 | 7.02 |
| 86 | 0.103459 | 5.61 | 0.080490 | 6.53 |
| 87 | 0.115502 | 5.20 | 0.090566 | 6.05 |
| 88 | 0.129018 | 4.81 | 0.102204 | 5.61 |
| 89 | 0.143810 | 4.45 | 0.115178 | 5.19 |
| 90 | 0.159458 | 4.11 | 0.129176 | 4.80 |
| 91 | 0.176551 | 3.80 | 0.144229 | 4.44 |
| 92 | 0.195360 | 3.50 | 0.160353 | 4.10 |
| 93 | 0.216286 | 3.23 | 0.177635 | 3.79 |
| 94 | 0.238799 | 2.99 | 0.196502 | 3.50 |
| 95 | 0.262268 | 2.77 | 0.216846 | 3.23 |
| 96 | 0.286291 | 2.58 | 0.238750 | 2.99 |
| 97 | 0.310944 | 2.41 | 0.261359 | 2.77 |
| 98 | 0.332325 | 2.27 | 0.283899 | 2.57 |
| 99 | 0.349036 | 2.15 | 0.306491 | 2.39 |
| 100 | 0.366568 | 2.04 | 0.329680 | 2.23 |
| 101 | 0.384960 | 1.93 | 0.353333 | 2.08 |
| 102 | 0.404252 | 1.83 | 0.377300 | 1.94 |
| 103 | 0.424488 | 1.72 | 0.401416 | 1.82 |
| 104 | 0.445712 | 1.63 | 0.425501 | 1.70 |
| 105 | 0.467998 | 1.54 | 0.451031 | 1.59 |
| 106 | 0.491398 | 1.45 | 0.478092 | 1.48 |
| 107 | 0.515968 | 1.36 | 0.506778 | 1.38 |
| 108 | 0.541766 | 1.28 | 0.537185 | 1.29 |
| 109 | 0.568854 | 1.20 | 0.568854 | 1.20 |
| 110 | 0.597297 | 1.13 | 0.597297 | 1.13 |
| 111 | 0.627162 | 1.05 | 0.627162 | 1.05 |
| 112 | 0.658520 | 0.98 | 0.658520 | 0.98 |
| 113 | 0.691446 | 0.92 | 0.691446 | 0.92 |
| 114 | 0.726018 | 0.85 | 0.726018 | 0.85 |
| 115 | 0.762319 | 0.79 | 0.762319 | 0.79 |
| 116 | 0.800435 | 0.74 | 0.800435 | 0.74 |
| 117 | 0.840457 | 0.68 | 0.840457 | 0.68 |
| 118 | 0.882480 | 0.63 | 0.882480 | 0.63 |
| 119 | 0.926604 | 0.58 | 0.926604 | 0.58 |

Tolerance: exact. Every one of the 120 ages from 0 to 119 is in the table once, and no other age.

## Wrong readings

- The previous edition (the 2022 period table of the 2025 Trustees Report): at 65, e = 17.48 for men and 20.12 for women, against 18.12 and 20.66; its q(119) is 1.000000 and e(119) 0.50.
- q rebuilt from the printed e by the half-year identity, q(x) = 1 − (e(x) − 0.5)/(e(x + 1) + 0.5): at 65 on this table 0.0161921 for men and 0.0103093 for women, against the published 0.016455 and 0.010188.
- The number-of-lives column read as a probability, or the male and female columns swapped: the first changes every value by orders of magnitude, the second reverses who outlives whom.

## Family

outputs: none.

feeds: `longevity-survival-percentile-age`, `monte-carlo-success-rate`, `monte-carlo-ending-investable-histogram`, `social-security-expected-present-value`, `social-security-survivor-switch-pv`, `social-security-fica-return-ratio`, `income-annuity-annual`, `spending-base-annual` (the amortization-based spending policy's survival-percentile horizon, worked out again on every projection) (through `mortality-published-death-probability` and the survival curve).

## Provenance

Transcribed from SSA's page by the D-LIFE-TABLE-2023 derivation (claude, opus 5.5, 2026-09-27: the live read, the Internet Archive capture and the slice 4 checker's read agree on every cell; the canonical hash rebuilt from the numbers in JavaScript) and compared cell by cell with a live read of the page by the independent check (F1: 0 mismatches in 480 cells, the same four hashes) (both in RetireGolden-Docs, `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-derivation.md` and `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-check.md`, at commit `75e1cf87`). Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.

Revision 2026-09-27 (the independent review's L1 (RetireGolden-Docs, `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-review.md`, at commit `75e1cf87`)): the source record carried a SHA-256 of the archive capture as the derivation downloaded it, `3eb1c287…`. That is a hash of the page as the archive renders it, which carries a per-fetch footer, so no one else can recompute it (the review's fetch of the same URL hashed to `c1d91a21…`, differing only in that footer). It is dropped rather than replaced by a hash of the raw capture: the table's own hash, `columnsSha256`, is defined over the cells, so it can be rebuilt from any read of the table (the live page, either form of the capture, or the stored numbers, as the evidence does), while a byte hash of an HTML file says nothing about the numbers that it does not, and depends on how the file was transferred (the raw capture hashes one way gzipped and another decoded). The capture's URL and time stay, so the table can be re-read from it; the review found its raw table equal to SSA's live page with 0 mismatches.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-3-longevity-ladders-taxes.md`.
