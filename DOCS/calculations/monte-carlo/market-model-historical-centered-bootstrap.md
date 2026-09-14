## Claim

Kind: model. `montecarlo/marketModels.ts#createHistoricalModel` samples embedded annual stock/bond/inflation rows by iid, fixed-length block, or wrapped sequence and emits blended return minus its historical mean as the plan-return shock.

## Justification

Subtracting the sample-series mean makes the empirical shock mean zero while retaining joint return/inflation observations and, for block/sequence modes, order. This does not claim history repeats or that a 60/40 blend fits every portfolio.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Sampled row | 1928: stocks 43.8, bonds 0.8 | percent |
| Equity weight | 60 | percent |
| Historical blended mean (fixture) | 8 | percent |

## Arithmetic

Row blend `=0.6(43.8)+0.4(0.8)=26.6%`. Centered shock `=26.6-8=18.6` percentage points.

## Expected

Return shock `18.6` percentage points for that independently supplied mean, absolute tolerance `1e-12`; inflation remains the row's `-1.2%`.

## Wrong readings

- Returning raw `26.6` as shock double counts an 8-point historical mean.
- Blending 60% bonds / 40% stocks gives `18.0%`, then shock `10.0`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
