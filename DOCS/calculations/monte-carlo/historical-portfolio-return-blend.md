## Claim

Kind: formula. `montecarlo/historicalReturns.ts#portfolioReturnPct` computes an annual nominal blended return `w*stocks+(1-w)*bonds` where `w=equityWeightPct/100`, without rounding.

## Justification

The one-period total return of a two-asset portfolio is the dollar-weighted arithmetic return. Domain: finite series values and equity weight normally 0–100%.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| 1928 stocks/bonds | 43.8 / 0.8 | percent |
| Equity weight | 60 | percent |

## Arithmetic

`0.6(43.8)+0.4(0.8)=26.28+0.32=26.60%`.

## Expected

`26.6%`, absolute tolerance `1e-12` percentage points.

## Wrong readings

- Reversing weights gives `18.0%`.
- Applying the 60 as a multiplier gives `60(43.8)-59(0.8)=2580.8%`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
