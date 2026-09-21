## Claim

Kind: data. `montecarlo/historicalReturns.ts#HISTORICAL_YEARS` stores 96 calendar-year observations, 1928–2023 inclusive, of S&P 500 total return, 10-year US Treasury total return, and CPI-U calendar-year inflation, all in percent and explicitly approximate to about 0.1–0.5 percentage point.

## Justification

Primary source named by the extract: Aswath Damodaran/NYU Stern, “Historical Returns on Stocks, Bonds and Bills,” derived from Shiller annual series; URL `https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html`; worksheet retrieval recorded 2026-09-14. Exact embedded sample rows are 1928 `43.8/0.8/-1.2`, 1929 `-8.3/4.2/0.6`, and 2023 `26.1/3.9/3.4` for stocks/bonds/inflation. Transformation is transcription and one-decimal storage; every value is approximate at the stated 0.1–0.5-point precision. Rights note: facts and three attributed rows are restated; the source's reuse license was not established, so the full table is not recopied here.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| First/last year | 1928 / 2023 | calendar year |
| Inclusive span | `2023-1928+1` | rows |

## Arithmetic

Inclusive expected row count `=96`; the extract contains 96 rows. Independent column sums are stocks `1118.9`, bonds `466.6`, inflation `298.8` percentage points.

## Expected

96 rows with those endpoints and sums; exact at the embedded one-decimal transcription, while source fidelity remains limited to approximately 0.1–0.5 percentage point per value.

## Wrong readings

- Exclusive counting gives 95 rows.
- Treating `43.8` as a fraction instead of percent makes 1928 stock return 4,380%.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
