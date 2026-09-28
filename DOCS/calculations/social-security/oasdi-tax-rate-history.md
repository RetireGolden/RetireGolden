## Claim

Kind: data. `socialSecurity/oasdiTaxRates.ts#OASDI_TAX_RATE_BY_YEAR` carries, for every calendar year from 1937, when the tax began, through 2026, the Social Security (OASDI) payroll tax rate each payer actually paid, in percent of taxable earnings: the employee's, the employer's, and the self-employed rate (none before 1951, when self-employment income was first taxed). `socialSecurity/analysis/oasdiReturn.ts#oasdiPaidIn` reads it, and uses the 2026 row, current law, for a later year.

New 2026-09-27 (B2-P1 slice 4, owner decision R8: "each year's statutory rate"). It replaces the parameter field `socialSecurity.oasdiEmployeeRatePct` (6.2 for 2026), which planner-ui applied to every year of a career and which is deleted.

## Justification

SSA, "Social Security Tax Rates" (ssa.gov/oact/progdata/oasdiRates.html; the derivation's copy is the Internet Archive capture of 2026-06-16, SHA-256 fdb4991d…, and the independent check read the live page on 2026-09-27): per year, the OASI, DI and total rates "for employees and employers, each" and "for self-employed workers". The page says "The rates shown reflect the amounts received by the trust funds. In certain years, the effective rate paid by employees, employers, and/or self-employed workers was less than the rate received by the trust funds, with the difference covered by general revenue", and gives the differences in two footnotes:

- "In 1984 only, an immediate credit of 0.3 percent of taxable wages was allowed against the OASDI taxes paid by employees, resulting in an effective employee tax rate of 5.4 percent." The employer paid the 5.7 percent trust-fund rate.
- "For 2011 and 2012, the OASDI tax rate is reduced by 2 percentage points for employees and for self-employed workers, resulting in a 4.2 percent effective tax rate for employees and a 10.4 percent effective tax rate for self-employed workers." The employer paid 6.2 percent.

The same footnote records self-employed credits of 2.7, 2.3 and 2.0 percent in 1984, 1985 and 1986-89 "against the combined OASDI and HI taxes"; the page does not allocate them to OASDI, so the self-employed rates for those years are the trust-fund rates, high by at most those credits (a stated limit of `oasdi-paid-in-today-dollars`). IRC 3101(a) sets today's employee rate, "6.2 percent of the wages", and IRC 1401(a) today's 12.4 percent self-employment rate.

The rate table and its footnotes, cut byte for byte from that capture, are committed as `sources/ssa-oasdi-rates.table.html` (the capture's URL, its whole-page SHA-256 and the byte range are in `sources/manifest.json`). The evidence test (`oasdiTaxRates.evidence.test.ts`) parses the table, applies footnotes a and c from their own text, and compares every year and payer of `oasdiTaxRates.ts` with the result.

## Inputs

The downloaded page, parsed by the derivation's script into `ssa-data.json` (employee, trust-fund and self-employed columns, with the footnote adjustments); the independent check compared the rates with the live page.

## Arithmetic

None: a transcription. The employee column is the trust-fund rate except 1984 (5.4) and 2011-2012 (4.2); the employer column is the trust-fund rate in every year; the self-employed column is the self-employed trust-fund rate except 2011-2012 (10.4), with none before 1951.

## Expected

| Year | Employee | Employer | Self-employed |
|---|---:|---:|---:|
| 1937 | 1 | 1 | none |
| 1938 | 1 | 1 | none |
| 1939 | 1 | 1 | none |
| 1940 | 1 | 1 | none |
| 1941 | 1 | 1 | none |
| 1942 | 1 | 1 | none |
| 1943 | 1 | 1 | none |
| 1944 | 1 | 1 | none |
| 1945 | 1 | 1 | none |
| 1946 | 1 | 1 | none |
| 1947 | 1 | 1 | none |
| 1948 | 1 | 1 | none |
| 1949 | 1 | 1 | none |
| 1950 | 1.5 | 1.5 | none |
| 1951 | 1.5 | 1.5 | 2.25 |
| 1952 | 1.5 | 1.5 | 2.25 |
| 1953 | 1.5 | 1.5 | 2.25 |
| 1954 | 2 | 2 | 3 |
| 1955 | 2 | 2 | 3 |
| 1956 | 2 | 2 | 3 |
| 1957 | 2.25 | 2.25 | 3.375 |
| 1958 | 2.25 | 2.25 | 3.375 |
| 1959 | 2.5 | 2.5 | 3.75 |
| 1960 | 3 | 3 | 4.5 |
| 1961 | 3 | 3 | 4.5 |
| 1962 | 3.125 | 3.125 | 4.7 |
| 1963 | 3.625 | 3.625 | 5.4 |
| 1964 | 3.625 | 3.625 | 5.4 |
| 1965 | 3.625 | 3.625 | 5.4 |
| 1966 | 3.85 | 3.85 | 5.8 |
| 1967 | 3.9 | 3.9 | 5.9 |
| 1968 | 3.8 | 3.8 | 5.8 |
| 1969 | 4.2 | 4.2 | 6.3 |
| 1970 | 4.2 | 4.2 | 6.3 |
| 1971 | 4.6 | 4.6 | 6.9 |
| 1972 | 4.6 | 4.6 | 6.9 |
| 1973 | 4.85 | 4.85 | 7 |
| 1974 | 4.95 | 4.95 | 7 |
| 1975 | 4.95 | 4.95 | 7 |
| 1976 | 4.95 | 4.95 | 7 |
| 1977 | 4.95 | 4.95 | 7 |
| 1978 | 5.05 | 5.05 | 7.1 |
| 1979 | 5.08 | 5.08 | 7.05 |
| 1980 | 5.08 | 5.08 | 7.05 |
| 1981 | 5.35 | 5.35 | 8 |
| 1982 | 5.4 | 5.4 | 8.05 |
| 1983 | 5.4 | 5.4 | 8.05 |
| 1984 | 5.4 | 5.7 | 11.4 |
| 1985 | 5.7 | 5.7 | 11.4 |
| 1986 | 5.7 | 5.7 | 11.4 |
| 1987 | 5.7 | 5.7 | 11.4 |
| 1988 | 6.06 | 6.06 | 12.12 |
| 1989 | 6.06 | 6.06 | 12.12 |
| 1990 | 6.2 | 6.2 | 12.4 |
| 1991 | 6.2 | 6.2 | 12.4 |
| 1992 | 6.2 | 6.2 | 12.4 |
| 1993 | 6.2 | 6.2 | 12.4 |
| 1994 | 6.2 | 6.2 | 12.4 |
| 1995 | 6.2 | 6.2 | 12.4 |
| 1996 | 6.2 | 6.2 | 12.4 |
| 1997 | 6.2 | 6.2 | 12.4 |
| 1998 | 6.2 | 6.2 | 12.4 |
| 1999 | 6.2 | 6.2 | 12.4 |
| 2000 | 6.2 | 6.2 | 12.4 |
| 2001 | 6.2 | 6.2 | 12.4 |
| 2002 | 6.2 | 6.2 | 12.4 |
| 2003 | 6.2 | 6.2 | 12.4 |
| 2004 | 6.2 | 6.2 | 12.4 |
| 2005 | 6.2 | 6.2 | 12.4 |
| 2006 | 6.2 | 6.2 | 12.4 |
| 2007 | 6.2 | 6.2 | 12.4 |
| 2008 | 6.2 | 6.2 | 12.4 |
| 2009 | 6.2 | 6.2 | 12.4 |
| 2010 | 6.2 | 6.2 | 12.4 |
| 2011 | 4.2 | 6.2 | 10.4 |
| 2012 | 4.2 | 6.2 | 10.4 |
| 2013 | 6.2 | 6.2 | 12.4 |
| 2014 | 6.2 | 6.2 | 12.4 |
| 2015 | 6.2 | 6.2 | 12.4 |
| 2016 | 6.2 | 6.2 | 12.4 |
| 2017 | 6.2 | 6.2 | 12.4 |
| 2018 | 6.2 | 6.2 | 12.4 |
| 2019 | 6.2 | 6.2 | 12.4 |
| 2020 | 6.2 | 6.2 | 12.4 |
| 2021 | 6.2 | 6.2 | 12.4 |
| 2022 | 6.2 | 6.2 | 12.4 |
| 2023 | 6.2 | 6.2 | 12.4 |
| 2024 | 6.2 | 6.2 | 12.4 |
| 2025 | 6.2 | 6.2 | 12.4 |
| 2026 | 6.2 | 6.2 | 12.4 |

Tolerance: exact. Every one of the 90 years from 1937 to 2026 is in the table, and no other year.

## Wrong readings

- Today's 6.2 percent for every year (the retired figure): overstates every year before 1990 and 2011-2012.
- The trust-fund rate as the employee's: 5.7 in 1984 and 6.2 in 2011-2012.
- Twice the employee rate as the self-employed rate before 1990: the self-employed paid 2.25 to 12.12 percent, not double.

## Family

outputs: none.

feeds: `social-security-oasdi-paid-in`.

## Provenance

Transcribed from the SSA page by the B2-P1 slice 4 derivation (claude, opus 5.5, 2026-09-27; its parse script and the capture's hash are in its evidence), and compared with the live page by the independent check (C4). Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.
