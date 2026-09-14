## Claim

Kind: model. `montecarlo/marketModels.ts#createLognormalModel` emits annual percentage-point return shock `100(exp(sigma Z-sigma^2/2)-1)` so its gross multiplier has mean one, plus normally distributed inflation with stated correlation; no result rounding is stated.

## Justification

For standard normal `Z`, `E[exp(sigma Z)]=exp(sigma^2/2)`, so subtracting `sigma^2/2` in the exponent centers the multiplier at one. This defines simulated dispersion, not a forecast or a guarantee that returns are lognormal.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Return volatility | 0 | percentage points/year |
| Inflation mean/volatility | 3 / 0 | percent/year |
| Normal draw | arbitrary | standard deviations |

## Arithmetic

`sigma=0`; shock `=100(exp(0)-1)=0`. Inflation `=3+0Z=3`.

## Expected

Every year has return shock `0` percentage points and inflation `3%`, exactly apart from array representation.

## Wrong readings

- Returning the gross multiplier as percent gives `100` rather than shock `0`.
- Adding plan expected return inside the model would double count it; for a 5% plan assumption the ledger would receive `5` shock instead of `0`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
