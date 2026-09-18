## Claim

Kind: model. `montecarlo/marketModels.ts#createUserShockModel` applies a user-specified additive percentage-point shock in one 1-based path year and uses a mean-preserving lognormal-style base in other years.

## Justification

An explicit shock isolates a user scenario while leaving the remaining stochastic process centered. It is a what-if, not an assigned crash probability.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Shock year | 2 | 1-based path year |
| Shock | -20 | percentage points |
| Base volatility | 0 | percentage points |
| Year count | 3 | years |

## Arithmetic

Years 1 and 3 have zero-volatility base shock `0`; year 2 receives `-20`. Vector `[0,-20,0]`.

## Expected

Return-shock vector `[0,-20,0]`, exact.

## Wrong readings

- Treating shock year as zero-based yields `[0,0,-20]`.
- Multiplying returns by -20 rather than adding -20 percentage points can produce nonsensical magnitudes.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
