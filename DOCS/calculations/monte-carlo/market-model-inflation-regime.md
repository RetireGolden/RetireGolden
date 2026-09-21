## Claim

Kind: model. `montecarlo/marketModels.ts#createInflationRegimeModel` samples normal versus high-inflation regimes by configured probability and correlates return shocks with inflation while retaining the plan's return-shock convention.

## Justification

A Bernoulli mixture represents a fat upper inflation tail more directly than one normal distribution. It is a stress model, not a forecast of regime incidence.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| High-inflation probability | 0.20 | probability |
| Regime draw | 0.10 | probability |
| High/base mean | 8 / 3 | percent/year |
| Innovation volatility | 0 | percentage points |

## Arithmetic

`0.10<0.20`, so high regime is selected; zero innovation leaves inflation at `8%`.

## Expected

Inflation `8%`, exact in this degenerate case.

## Wrong readings

- Reversing the Bernoulli comparison selects `3%`.
- Adding high and base means gives `11%`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
