## Claim

Kind: formula. `socialSecurity/analysis/oasdiReturn.ts#oasdiPaidIn` sums, over an earnings history, each year's Social Security (OASDI) tax at that year's effective statutory rate on the earnings capped at that year's contribution and benefit base, and restates each year's tax in the start year's dollars by the ratio of the CPI-U annual average of the latest published year to that year's, then by the plan's inflation from the latest published year to the start year. It publishes the person's tax (the employee's, or the self-employed rate on the whole) and the employer's, each in today's and in the dollars actually paid, for the entered years through the start year (paid in so far); the same taxes on the projected work, the years the PIA's earnings projection fills and any entered year after the start (what the projected work will pay); and the years it did not count.

For rows with a positive amount (rows for one year are added first), with L the latest year with a published CPI-U annual average (2025) and i the plan's inflation:

- capped(y) = min(earnings(y), base(y)), base from `socialSecurity/ssaWageData.ts#WAGE_BASE_BY_YEAR` (SSA, 1937 to 2026; the latest for a later year);
- rate(y) = the employee's effective rate, or the self-employed rate, from `socialSecurity/oasdiTaxRates.ts` (`oasdi-tax-rate-history`); employer(y) the employer's rate, 0 for the self-employed;
- I(y) = CPI(L)/CPI(y) × (1 + i)^(start − L) for y ≤ L, and (1 + i)^(start − y) for L < y ≤ start (`cpi-u-annual-average`); I(start) = 1 for a year after the start;
- paidInToday = Σ over entered years y ≤ start of capped(y) × rate(y)/100 × I(y); paidInNominal = Σ capped(y) × rate(y)/100; the employer's likewise;
- projectedToday = Σ over the projected work of capped(y) × rate(y)/100 × I(min(y, start)), with rate(y) the 2026 row, current law, for a year after the table and base(y) the latest published base, as the PIA computation caps a projected year; the employer's likewise.

The projected work is what the PIA counts beyond the entered history: `oasdiReturnForPerson` passes the years `computePiaFromEarnings` fills from the stream's earnings projection, at the amount it assumes, and an entered year after the start year joins them. A year after the start counts at its face amount (I = 1), because the PIA computation counts it that way, on the latest published base and wage index, so the get-back's PIA and the paid-in stand on the same career. A year before 1937, or self-employed before 1951, is named in `excludedYears` and not counted. Nothing is rounded; the page prints whole dollars.

Restated 2026-09-27 (the slice's independent review, F4): the paid-in counted the entered years only while the get-back's PIA counted the projection's years as well, so a 45-year-old with a projection to 65 was shown a ratio over the history alone (2.36 in the review's case, 1.53 over the same career). The projected work is now counted, beside the history, and an entered year after the start is part of it rather than left out.

New 2026-09-27 (B2-P1 slice 4, owner decision R8: "paid-in taxes are restated in today's dollars with a published index and each year's statutory rate"). Until then planner-ui's `socialSecurity/ficaReturn.ts#ficaOasdiPaidIn` applied today's 6.2% (12.4% self-employed) to every year, capped every year before 1979 at today's base, and summed the nominal taxes under a "today's dollars" label.

## Justification

- Rates: SSA, "Social Security Tax Rates", per calendar year from 1937, "for employees and employers, each" and "for self-employed workers", with its footnotes for the years whose effective rate differs from the trust-fund rate (1984 for employees; 2011 and 2012 for employees and the self-employed). IRC 3101(a) sets today's "6.2 percent of the wages" and IRC 1401(a) today's 12.4 percent self-employment rate.
- Base: SSA, "Contribution and benefit bases, 1937-2026"; 42 U.S.C. 430 and, before 1975, the amounts 415(e)(1) lists.
- Index: BLS, CPI for All Urban Consumers, U.S. city average, all items (CUUR0000SA0), the published annual averages. The derivation chose CPI-U: it is published as a primary series back to 1937, and "today's dollars" means price-adjusted dollars everywhere else in the app. Restating by prices alone credits no interest (a stated limit).
- The history is SSA's "taxed Social Security earnings" (`YearEarning.amount`); for a self-employed year that is already net earnings from self-employment, so no separate self-employment deduction is taken.

## Inputs

| Case | History | Status | Start | Inflation |
|---|---|---|---:|---:|
| A | $50,000 in every year 1982-2021 (40 years) | employee | 2026 | 2.5% |
| A-SE | as A | self-employed | 2026 | 2.5% |
| B | $20,000 in each of 1975-1978 | employee | 2026 | 2.5% |
| X | $10,000 in 1936, 1950 and 2030 | self-employed | 2026 | 2.5% |
| P | $60,000 in every year 2003-2025, and the projection's $60,000 in 2026-2042 | employee | 2026 | 2.5% |

## Arithmetic

**A, nominal (by hand).** Capped at the base in 1982-89: 1982 32,400 × 5.40% = 1,749.60; 1983 35,700 × 5.40% = 1,927.80; 1984 37,800 × 5.40% = 2,041.20 (the employee's credited rate); 1985 39,600 × 5.70% = 2,257.20; 1986 42,000 × 5.70% = 2,394.00; 1987 43,800 × 5.70% = 2,496.60; 1988 45,000 × 6.06% = 2,727.00; 1989 48,000 × 6.06% = 2,908.80 (18,502.20 in all). 1990-2010: 21 × 3,100 = 65,100. 2011-2012: 2 × 2,100 = 4,200. 2013-2021: 9 × 3,100 = 27,900. Total 115,702.20. The employer paid 5.70% in 1984 (+113.40) and 6.2% in 2011-2012 (+2,000): 117,815.60.

**A, today's dollars.** I(y) = 321.943/CPI(y) × 1.025: 1982 (CPI 96.5), 3.419602, so 1,749.60 → 5,982.94; 1984 (103.9), 3.176050, 2,041.20 → 6,482.95; 1990 (130.7), 2.524802, 3,100 → 7,826.89; 2011 (224.939), 1.467027, 2,100 → 3,080.76; 2021 (270.97), 1.217816, 3,100 → 3,775.23. Total 225,418.24; employer 228,682.71.

**A-SE.** 8.05% in 1982-83, 11.4% in 1984-87, 12.12% in 1988-89, 12.4% from 1990, 10.4% in 2011-12: nominal 231,758.45, today's 448,161.55.

**B (bases before 1979).** 14,100, 15,300, 16,500 and 17,700 at 4.95% (1975-77) and 5.05% (1978): 697.95 + 757.35 + 816.75 + 893.85 = 3,165.90 nominal; with CPI 53.8, 56.9, 60.6 and 65.2 that is 17,644.76 today. The retired figure capped at 184,500 and taxed at 6.2%: 4,960.

**X.** 1936 is before the tax began and 1950 before self-employment was taxed: neither is counted, and both are named. 2030 is after the start: it is projected work, 10,000 × 12.4% = 1,240 at its face amount.

**P.** The history: 2003-2025 on 60,000 (under every base from 87,000), 3,720 a year at 6.2% and 2,520 in 2011 and 2012 at 4.2%, 83,160 nominal, 116,507.46 in 2026 dollars (the employer's 85,560 nominal, 2011-2012 at 6.2%, and 119,992.63). The projected work: 2026 to 2042, the years a person born 1981-06-15 reaches 45 to 61 (the PIA window ends at 61), 17 × 60,000 × 6.2% = 63,240, and the employer's the same.

## Expected

| Case | paidInNominal | paidInToday | employerNominal | employerToday | projectedToday | projectedEmployerToday |
|---|---:|---:|---:|---:|---:|---:|
| A | 115,702.2 | 225,418.2398526663 | 117,815.6 | 228,682.71394574322 | 0 | 0 |
| A-SE | 231,758.45 | 448,161.5495308154 | 0 | 0 | 0 | 0 |
| B | 3,165.9 | 17,644.755194805228 | 3,165.9 | 17,644.755194805228 | 0 | 0 |
| X | 0 | 0 | 0 | 0 | 1,240 | 0 |
| P | 83,160 | 116,507.46237712375 | 85,560 | 119,992.63443101046 | 63,240 | 63,240 |

Tolerance: nominal and projected amounts to a cent (1e−6 absolute, float addition), today's amounts 1e−12 relative. X names 1936 and 1950 as not counted, and 2030 as projected work; P's projected work is 2026 to 2042. The retired figures for A and B were 119,306.60 and 4,960.

## Wrong readings

- Today's rate for every year (the retired figure): A 119,306.60 nominal.
- A nominal sum called today's dollars (the retired label).
- The trust-fund rate as the employee's: A would be 117,815.60, the employer's figure.
- The latest base for a year before 1979: B 4,960.
- The national average wage index instead of CPI-U: not what R8 decided; it restates by wage growth, larger for most careers.
- The entered years only, with the PIA from a projected career (the slice's figure before the review): P's paid-in 116,507.46 against a get-back priced on 17 more years of work.
- The projected years deflated by the plan's inflation from the start year: P's projected work 52,284.61, a price change the PIA computation does not make.

## Family

outputs: `social-security-oasdi-paid-in`.

feeds: `social-security-fica-return-ratio`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 4 derivation, worksheet `social-security-oasdi-paid-in.md` (nominal totals by hand, today's totals by its independent model on the downloaded SSA and BLS series); independently checked (the check's C4: every case reproduced with BLS's published annual averages; its correction that the index must be the published average for every year, six of which differed in the derivation's series and none of which these cases use). Case X is new here, and restated with case P for the review's F4 (P by hand above and by the review's independent model, `ssmodel.py`, which imports nothing from the engine). Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-6-after-769.md`.
