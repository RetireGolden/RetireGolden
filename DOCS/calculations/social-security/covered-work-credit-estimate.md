## Claim

Kind: formula. `socialSecurity/analysis/credits.ts#estimateCredits` estimates the covered-work credits (quarters of coverage) an earnings history earns, at most 40, for the Social Security step's eligibility note. An entered credit count wins. Otherwise the history's rows are added by calendar year and each year earns `#creditsForYear`: from 1978, min(4, floor(earnings / that year's quarter-of-coverage amount)), with SSA's amounts (`socialSecurity/ssaWageData.ts#QUARTER_OF_COVERAGE_AMOUNT_BY_YEAR`, 1978 to 2026, the latest for a later year); before 1978, min(4, floor(earnings / 50)), the most a year could have earned; nothing before 1937. Eligible means at least 40.

New 2026-09-27 (B2-P1 slice 4, owner decision R10). R10 kept the single 2025 amount, $1,810, for every year "until a per-year table is added"; the derivation found the table in hand from SSA and the 2025 amount already stale for 2026, and the independent check agreed to add it now, with years before 1978 counted at the upper bound. Until then planner-ui's `socialSecurity/explain.ts#estimateCredits` divided every row by 1,810, capped each row (not each year) at four, and credited years before 1937.

## Justification

- 42 U.S.C. 413(a)(2)(A): a quarter of coverage is "(i) for calendar years before 1978 ... a quarter in which an individual has been paid $50 or more in wages ... or for which he has been credited ... with $100 or more of self-employment income; and (ii) for calendar years after 1977 ... each portion of the total of the wages paid and the self-employment income credited ... to an individual in a calendar year which equals the amount required for a quarter of coverage in that calendar year"; 413(d)(1) sets "$250 in the calendar year 1978" and indexes later years.
- 20 CFR 404.143(a): "we cannot credit you with more than four QCs for any calendar year".
- SSA, "Quarter of Coverage" (ssa.gov/oact/cola/QC.html; the derivation's copy is the Internet Archive capture of 2026-09-22): "The amount of earnings required for a quarter of coverage (QC) in 2026 is $1,890", with the series from 1978. The series table, cut byte for byte from that capture, is committed as `sources/ssa-quarter-of-coverage.table.html` (URL, digests and byte range in `sources/manifest.json`), and the evidence test compares every year of `QUARTER_OF_COVERAGE_AMOUNT_BY_YEAR` with it. The independent check read the live page and confirmed the 2026 amount and the series.
- An annual history cannot say which calendar quarter the wages before 1978 fell in, so the count for those years is an upper bound, one per $50 up to four; a lower bound would raise false "not eligible" warnings. The $100 self-employment rule is not applied separately. No work was covered before 1937, when the program's taxes began.

## Inputs

| Case | History | Entered count |
|---|---|---|
| A | 1980 $1,200; 1990 $1,500; 2025 $5,000; 2026 $7,000 | none |
| B | as A plus 1975 $900 | none |
| C | $7,240 in each of 2016-2025 | none |
| D | none | 12 |
| E | 1936 $5,000; 2025 $2,000 in two rows of $1,000 | none |

## Arithmetic

**A.** 1980: floor(1,200 / 290) = 4. 1990: floor(1,500 / 520) = 2. 2025: floor(5,000 / 1,810) = 2. 2026: floor(7,000 / 1,890) = 3. Total 11; the single 2025 amount gave 0 + 0 + 2 + 3 = 5.

**B.** 1975 adds min(4, floor(900 / 50)) = 4: 15 (the single amount: 5).

**C.** The amounts for 2016-2025 are 1,260 to 1,810, all at most 1,810, so each year earns min(4, floor(7,240 / amount)) = 4: 40, eligible (the single amount: 40).

**D.** The entered count: 12, not eligible, not estimated.

**E.** 1936 earns nothing; the two 2025 rows add to 2,000, floor(2,000 / 1,810) = 1. Total 1 (the retired rows credited 1936 at the 2025 amount, 2, and each 2025 row separately, 0 + 0).

## Expected

| Case | Credits | Eligible | Retired figure |
|---|---:|---|---:|
| A | 11 | no | 5 |
| B | 15 | no | 5 |
| C | 40 | yes | 40 |
| D | 12 | no | 12 |
| E | 1 | no | 2 |
| QC 1978 | 250 |
| QC 1979 | 260 |
| QC 1980 | 290 |
| QC 1981 | 310 |
| QC 1982 | 340 |
| QC 1983 | 370 |
| QC 1984 | 390 |
| QC 1985 | 410 |
| QC 1986 | 440 |
| QC 1987 | 460 |
| QC 1988 | 470 |
| QC 1989 | 500 |
| QC 1990 | 520 |
| QC 1991 | 540 |
| QC 1992 | 570 |
| QC 1993 | 590 |
| QC 1994 | 620 |
| QC 1995 | 630 |
| QC 1996 | 640 |
| QC 1997 | 670 |
| QC 1998 | 700 |
| QC 1999 | 740 |
| QC 2000 | 780 |
| QC 2001 | 830 |
| QC 2002 | 870 |
| QC 2003 | 890 |
| QC 2004 | 900 |
| QC 2005 | 920 |
| QC 2006 | 970 |
| QC 2007 | 1000 |
| QC 2008 | 1050 |
| QC 2009 | 1090 |
| QC 2010 | 1120 |
| QC 2011 | 1120 |
| QC 2012 | 1130 |
| QC 2013 | 1160 |
| QC 2014 | 1200 |
| QC 2015 | 1220 |
| QC 2016 | 1260 |
| QC 2017 | 1300 |
| QC 2018 | 1320 |
| QC 2019 | 1360 |
| QC 2020 | 1410 |
| QC 2021 | 1470 |
| QC 2022 | 1510 |
| QC 2023 | 1640 |
| QC 2024 | 1730 |
| QC 2025 | 1810 |
| QC 2026 | 1890 |

The QC rows are SSA's amounts, which the table must equal year for year, 1978 to 2026 and no other year. Tolerance: exact (integers).

## Wrong readings

- One amount for every year (the retired rule): A 5, B 5.
- Rounding a partial credit up: A would read 1 + 1 + 3 + 4 = 9 on the single amount.
- No cap of four a year: C with $20,000 years would count 11 a year.
- Capping each row rather than each year: two $7,240 rows for one year would count 8.
- The entered count treated as an addition: D would read 12 plus the estimate.

## Family

outputs: `social-security-credit-estimate`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 4 derivation, worksheet `social-security-credit-estimate.md` (by hand; the per-year table was its open question 5); independently checked (B1 and C6: 5 and 11, 5 and 15, 40, 12; the 2026 amount on the live SSA page). Case E is new here. Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`.
