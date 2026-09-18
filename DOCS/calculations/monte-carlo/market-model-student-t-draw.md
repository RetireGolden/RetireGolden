## Claim

Kind: model. `montecarlo/marketModels.ts#createStudentTModel` emits centered Student-t return shocks scaled to the configured annual volatility, with lower degrees of freedom producing fatter tails, then inflation and optional class draws in the documented order.

## Justification

For `df>2`, a standard t variate has variance `df/(df-2)`; multiplying by `sqrt((df-2)/df)` gives unit variance before volatility scaling. This tail model does not claim future returns follow a t distribution.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Degrees of freedom | 5 | count |
| Target volatility | 12 | percentage points/year |
| t draw | 0 | raw t units |

## Arithmetic

Scaled draw `=0*sqrt(3/5)=0`; shock `=12(0)=0` percentage points.

## Expected

Return shock `0`, absolute tolerance `0` for a zero draw.

## Wrong readings

- Adding the configured volatility as a mean gives `12` points.
- Omitting variance scaling would make nonzero draws have volatility `12*sqrt(5/3)=15.4919` points.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
