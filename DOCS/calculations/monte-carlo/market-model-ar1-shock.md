## Claim

Kind: model. `montecarlo/marketModels.ts#createAR1Model` evolves a centered serially correlated shock by the AR(1) convention `x_t=phi*x_(t-1)+innovation_t`, with configured persistence/mean reversion.

## Justification

For `|phi|<1` and zero-mean innovations, the long-run mean is zero; positive phi creates persistence while shocks decay geometrically without new innovations. This is a dynamics assumption, not evidence of a true return process.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Prior shock | 10 | percentage points |
| `phi` | 0.2 | ratio |
| Innovation | 0 | percentage points |

## Arithmetic

`x_t=0.2(10)+0=2` percentage points; one more zero-innovation year gives `0.2(2)=0.4`.

## Expected

Next two shocks `2` and `0.4` percentage points, absolute tolerance `1e-12`.

## Wrong readings

- Using `1-phi=0.8` as persistence gives `8` then `6.4`.
- Adding phi as percentage points gives `10.2`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
