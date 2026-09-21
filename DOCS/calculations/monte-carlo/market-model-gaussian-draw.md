## Claim

Kind: model. `montecarlo/marketModels.ts#createGaussianModel` emits additive symmetric normal return shocks `sigma Z` in percentage points, centered at zero, with correlated normal inflation and optional class shocks.

## Justification

A standard normal has mean zero and variance one; scaling by `sigma` gives target volatility. The unbounded lower tail can imply returns below -100%, an explicit limitation.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Volatility | 12 | percentage points |
| Standard-normal draw | -2 | standard deviations |

## Arithmetic

Shock `=12(-2)=-24` percentage points.

## Expected

Return shock `-24`, exact for these inputs.

## Wrong readings

- Dividing volatility by 100 twice gives `-0.24` percentage points.
- Applying a lognormal exponential gives a skewed result rather than `-24`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
