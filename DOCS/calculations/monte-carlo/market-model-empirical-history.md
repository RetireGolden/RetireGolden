## Claim

Kind: model. `montecarlo/marketModels.ts#createEmpiricalModel` samples historical blended returns either centered by their historical mean or raw; raw mode emits the historical return as a shock and therefore adds it atop the plan assumption.

## Justification

Centered mode studies dispersion about the plan mean; raw mode deliberately preserves the empirical level but risks double counting because the projection adds expected return separately. Neither mode predicts future returns.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Sample blended return | 10 | percent |
| Historical mean | 8 | percent |
| Plan expected return | 6 | percent |

## Arithmetic

Centered shock `=10-8=2`, ledger return `=6+2=8%`. Raw shock `=10`, ledger return `=6+10=16%`.

## Expected

Centered/raw shocks `2/10` points and resulting returns `8%/16%`, exact for integer percentages.

## Wrong readings

- Calling raw mode's final return `10%` ignores the projection's added 6%.
- Subtracting the plan mean rather than historical mean yields centered shock `4` and return `10%`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
