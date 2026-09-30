## Claim

Kind: data. `socialSecurity/cpiU.ts#CPI_U_ANNUAL_AVERAGE` carries the annual average of the Consumer Price Index for All Urban Consumers, U.S. city average, all items, not seasonally adjusted (BLS series CUUR0000SA0, 1982-84 = 100), as BLS publishes it for each year from 1937 through 2025 (one decimal before 2007, three from 2007). `socialSecurity/analysis/oasdiReturn.ts#oasdiPaidIn` restates each year's Social Security tax in today's dollars by the ratio of these averages, and uses the plan's inflation after 2025 (`CPI_U_LATEST_YEAR`).

New 2026-09-27 (B2-P1 slice 4, owner decision R8: "a published index").

## Justification

BLS publishes an annual average for each year of the series (period M13 in its data), and its data viewer prints it as the table's "Annual" column: `https://data.bls.gov/timeseries/CUUR0000SA0?years_option=specific_years&from_year=1937&to_year=2025&include_graphs=false&output_view=data&annualAveragesRequested=true`. The slice's independent review read that column for all 89 years on 2026-09-27 at 21:57 UTC, and every year equals the table here, so that page is the source of every value. (The check had read the averages from the BLS public data API for 1937-1995 and 2016-2025, and, when the API's daily request limit refused 1996-2015, averaged those twenty years' monthly values; the published averages the review read are the same twenty values.) The check corrected the derivation's series, which had recomputed every year before 2024 as such a mean: six years differ by 0.1 from the published figure (1948 24.1, 1952 26.5, 1953 26.7, 1959 29.1, 1962 30.2 and 1966 32.4 are published). A request made while implementing this slice met the same daily limit. October 2025 was not collected ("Data unavailable due to the 2025 lapse in appropriations"); BLS still publishes the 2025 annual average, 321.943, which is used as published.

The publishers' bytes are committed in `sources/bls-cpiu/` and listed with their URLs, requests, retrieval date and SHA-256 in `sources/manifest.json`: the API responses with M13 for 1937-1995 and 2016-2025, the monthly responses for 1996-2015, and the review's extract of the viewer's column. The evidence test (`cpiU.evidence.test.ts`) parses those files and compares every year of `cpiU.ts` with them, checks that the two readings agree, and checks every file's digest against the manifest.

## Inputs

The BLS data viewer's "Annual" column for CUUR0000SA0, 1937-2025, as the slice review saved it (`bls-cpiu-annual.json`), and the independent check's `cpiu_annual.json`, which agrees in every year.

## Arithmetic

None: a transcription.

## Expected

| Year | Annual average |
|---|---:|
| 1937 | 14.4 |
| 1938 | 14.1 |
| 1939 | 13.9 |
| 1940 | 14 |
| 1941 | 14.7 |
| 1942 | 16.3 |
| 1943 | 17.3 |
| 1944 | 17.6 |
| 1945 | 18 |
| 1946 | 19.5 |
| 1947 | 22.3 |
| 1948 | 24.1 |
| 1949 | 23.8 |
| 1950 | 24.1 |
| 1951 | 26 |
| 1952 | 26.5 |
| 1953 | 26.7 |
| 1954 | 26.9 |
| 1955 | 26.8 |
| 1956 | 27.2 |
| 1957 | 28.1 |
| 1958 | 28.9 |
| 1959 | 29.1 |
| 1960 | 29.6 |
| 1961 | 29.9 |
| 1962 | 30.2 |
| 1963 | 30.6 |
| 1964 | 31 |
| 1965 | 31.5 |
| 1966 | 32.4 |
| 1967 | 33.4 |
| 1968 | 34.8 |
| 1969 | 36.7 |
| 1970 | 38.8 |
| 1971 | 40.5 |
| 1972 | 41.8 |
| 1973 | 44.4 |
| 1974 | 49.3 |
| 1975 | 53.8 |
| 1976 | 56.9 |
| 1977 | 60.6 |
| 1978 | 65.2 |
| 1979 | 72.6 |
| 1980 | 82.4 |
| 1981 | 90.9 |
| 1982 | 96.5 |
| 1983 | 99.6 |
| 1984 | 103.9 |
| 1985 | 107.6 |
| 1986 | 109.6 |
| 1987 | 113.6 |
| 1988 | 118.3 |
| 1989 | 124 |
| 1990 | 130.7 |
| 1991 | 136.2 |
| 1992 | 140.3 |
| 1993 | 144.5 |
| 1994 | 148.2 |
| 1995 | 152.4 |
| 1996 | 156.9 |
| 1997 | 160.5 |
| 1998 | 163 |
| 1999 | 166.6 |
| 2000 | 172.2 |
| 2001 | 177.1 |
| 2002 | 179.9 |
| 2003 | 184 |
| 2004 | 188.9 |
| 2005 | 195.3 |
| 2006 | 201.6 |
| 2007 | 207.342 |
| 2008 | 215.303 |
| 2009 | 214.537 |
| 2010 | 218.056 |
| 2011 | 224.939 |
| 2012 | 229.594 |
| 2013 | 232.957 |
| 2014 | 236.736 |
| 2015 | 237.017 |
| 2016 | 240.007 |
| 2017 | 245.12 |
| 2018 | 251.107 |
| 2019 | 255.657 |
| 2020 | 258.811 |
| 2021 | 270.97 |
| 2022 | 292.655 |
| 2023 | 304.702 |
| 2024 | 313.689 |
| 2025 | 321.943 |

Tolerance: exact. Every one of the 89 years from 1937 to 2025 is in the table, and no other year.

## Wrong readings

- A recomputed mean of the monthly values for every year (the derivation's first series): 1948 24.0, 1952 26.6, 1953 26.8, 1959 29.2, 1962 30.3 and 1966 32.5.
- The seasonally adjusted series: BLS publishes no annual average for it.
- The wage index SSA uses for benefits: not a price index, and not what R8 decided.

## Family

outputs: none.

feeds: `social-security-oasdi-paid-in`.

## Provenance

Transcribed from the BLS figures read by the B2-P1 slice 4 independent check (C4 and its correction 5); the derivation's own series agrees in the other 83 years. Restated 2026-09-27 for the slice review's F9: the review read BLS's published annual averages for all 89 years from the data viewer, all equal to this table, so no year rests on a recomputed mean and the limit that said so is removed. Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`.
