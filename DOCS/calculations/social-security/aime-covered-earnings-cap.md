## Claim

Kind: composition. `socialSecurity/piaFromEarnings.ts#computePiaFromEarnings` counts each computation base year's covered earnings only up to that year's contribution and benefit base, `socialSecurity/ssaWageData.ts#WAGE_BASE_BY_YEAR` (SSA's bases for every year from 1937 through 2026, read through `#wageBaseForYearOrLatest`, which uses the latest base only for a later year SSA has not set), wage-indexes the capped amount, and takes its window of years from 1951 (`#FIRST_COMPUTATION_BASE_YEAR`) or the year the worker turns 22, whichever is later, through the year before 62. The five lowest indexed years are dropped and the rest averaged over their months (the AIME); `#piaMonthlyFromAime` gives the PIA.

New 2026-09-27 (decision D-SS-LAW-2, problem 5 of the B2-P1 slice 4 derivation, confirmed by its independent check). Until then the base table started at 1979, so every earlier year was capped at the latest base, $184,500, and the window was not floored at 1951.

## Justification

42 U.S.C. 415(e)(1): "in computing an individual's average indexed monthly earnings ... there shall not be counted the excess over $3,600 in the case of any calendar year after 1950 and before 1955, the excess over $4,200 in the case of any calendar year after 1954 and before 1959, the excess over $4,800 in the case of any calendar year after 1958 and before 1966, the excess over $6,600 in the case of any calendar year after 1965 and before 1968, the excess over $7,800 in the case of any calendar year after 1967 and before 1972, the excess over $9,000 in the case of any calendar year after 1971 and before 1973, the excess over $10,800 in the case of any calendar year after 1972 and before 1974, the excess over $13,200 in the case of any calendar year after 1973 and before 1975, and the excess over an amount equal to the contribution and benefit base (as determined under section 430 of this title) in the case of any calendar year after 1974 ... (before the application, in the case of average indexed monthly earnings, of subsection (b)(3)(A))". The cap applies before indexing.

SSA, "Contribution and benefit bases, 1937-2026" (ssa.gov/oact/cola/cbb.html, read 2026-09-27; the independent check read it live and the derivation from an Internet Archive capture of 2026-09-15, and the two agree): $3,000 for 1937-50, $3,600 for 1951-54, $4,200 for 1955-58, $4,800 for 1959-65, $6,600 for 1966-67, $7,800 for 1968-71, $9,000 for 1972, $10,800 for 1973, $13,200 for 1974, $14,100 for 1975, $15,300 for 1976, $16,500 for 1977, $17,700 for 1978, and from 1979 the rows the table already carried ($22,900 through $184,500 in 2026).

42 U.S.C. 415(b)(2)(B)(ii): "the term 'computation base years' means the calendar years after 1950"; (b)(2)(B)(iii) starts the elapsed years after 1950 or, if later, the year age 21 is attained; (b)(2)(A) makes the computation years the elapsed years less five. With the table reaching back to 1937, the window must start at 1951 or an earlier year would now be counted at its (small) base and indexed by a stand-in wage index; there is no average wage index before 1951.

## Inputs

| Case | Worker | Covered earnings | Eligibility (age 62), indexing year, AWI, bend points |
|---|---|---|---|
| A (the check's born-1956 case) | born 1956-08-14 | $50,000 in every year 1978 through 2017 | 2018; 2016, 48,642.15; 895 and 5,397 |
| B | born 1925-03-03 | $20,000 in 1960 and in 1970, nothing else | 1987; 1985, 16,822.51; 310 and 1,866 |

AWI for the years used: 1960 4,007.12, 1970 6,186.24, 1978 10,556.03, 1979 11,479.46 (SSA's series, which the engine's table equals).

## Arithmetic

Case A. The window runs from 1978 (age 22) to 2017. The 1978 wage is counted up to that year's base, 17,700, and indexed: \(17700\times48642.15/10556.03=81{,}561.54\), which the engine floors to 81,561 (a separate registered approximation rounds to the dollar rather than the penny). The years 1979 to 1989 are capped at 22,900 to 48,000 (1979 indexes to 97,034.64); from 1990 the base exceeds 50,000. The five dropped years are 2016 and 2017 (50,000, unindexed), 2015 (50,565.01), 2014 (52,324.18) and 2013 (54,181.49). The 35 years left sum to 3,123,363 in the engine's whole dollars (3,123,379.10 to the penny), so the AIME is \(\lfloor 3123363/420\rfloor=\) **7,436** either way, and the PIA is \(0.9\times895+0.32\times(5397-895)+0.15\times(7436-5397)=2{,}551.99\), floored to the dime: **$2,551.90**. Counting the whole 1978 wage indexes it to 230,399, the sum to 3,272,201, the AIME to 7,790 and the PIA to \(2{,}605.09\to\$2{,}605.00\).

Case B. The window runs from 1951 (the worker turned 22 in 1947) to 1986: 36 elapsed years and 31 computation years. 1960 counts 4,800, indexed \(4800\times16822.51/4007.12=20{,}151.14\to20{,}151\); 1970 counts 7,800, indexed \(7800\times16822.51/6186.24=21{,}210.88\to21{,}210\). AIME \(\lfloor(20151+21210)/372\rfloor=\) **111**; PIA \(0.9\times111=\) **$99.90**. Before: the window started at 1947 and every year was capped at 184,500, so the full 20,000 counted (83,963 and 54,386 indexed) over 35 years: AIME \(\lfloor138349/420\rfloor=329\), PIA \(0.9\times310+0.32\times19=285.08\to\$285.00\).

## Expected

| Case | Before (engine to 2026-09-26) | After |
|---|---:|---:|
| A, 1978 counted | 50,000 | **17,700** |
| A, 1978 indexed | 230,399 | **81,561** |
| A, AIME | 7,790 | **7,436** |
| A, PIA | 2,605.00 | **2,551.90** |
| B, first window year | 1947 | **1951** |
| B, computation years | 35 | **31** |
| B, AIME | 329 | **111** |
| B, PIA | 285.00 | **99.90** |

AIME, counted and indexed dollars, and years are integers and compared exactly; a PIA is a multiple of $0.10, compared within $0.005. The PIA is in eligibility-year dollars; the projection raises it by the cost-of-living increases since (pia-cost-of-living-since-eligibility).

## Wrong readings

- Every year before 1979 capped at the latest base (the engine before 2026-09-27): A 7,790 and 2,605.00.
- The table extended to 1937 without the 1951 start: B would start at 1947, count 3,000 for 1947 to 1950 if there were earnings, and still divide by 35 years: AIME \(\lfloor41361/420\rfloor=98\), PIA $88.20.
- The cap applied after indexing rather than before, to every year: each indexed year would be cut to its nominal base (1978 to 17,700, 1990 to 51,300), and A's AIME would fall to 4,755.
- No cap at all for years the table does not reach: the same as the first reading here.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

Case A, its before-figures and the fix are from the B2-P1 slice 4 derivation (problem 5) and its independent check (A4, including the note to keep computation years after 1950), RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice4-derivation.md` and `b2p1-slice4-check.md`; the statute and SSA's bases are as saved by that check (the deriver's copy agrees row for row). Case B was added for the 1951 start. The after-figures were recomputed by a script that does not import the engine, with exact fractions, and the before-figures by running the engine at RetireGolden `4a80669e`. Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`.
