## Claim

Kind: model. `montecarlo/marketModels.ts#createGarchModel` uses a GARCH(1,1) variance recursion `v_t=omega+alpha*epsilon_(t-1)^2+beta*v_(t-1)` and a centered innovation to model volatility clustering.

## Justification

The recursion raises next variance after a large squared shock and carries persistence through `beta`. This is the formula implied by the named GARCH(1,1) convention; the extract does not state initialization or parameter validation, so the model's empirical suitability remains unproved.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| `omega, alpha, beta` | 1, 0.1, 0.8 | variance units |
| Prior shock `epsilon` | 2 | return units |
| Prior variance | 4 | squared return units |

## Arithmetic

`v_t=1+0.1(2^2)+0.8(4)=1+0.4+3.2=4.6`.

## Expected

Next variance `4.6`, absolute tolerance `1e-12`, conditional on the standard GARCH convention named in the comment.

## Wrong readings

- Using the unsquared prior shock gives `4.4`.
- Applying beta to standard deviation 2 rather than variance 4 gives `3.0`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
