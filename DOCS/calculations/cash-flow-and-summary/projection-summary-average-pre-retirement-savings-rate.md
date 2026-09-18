## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` computes the arithmetic mean, in percentage points, of the published `savingsRates[].ratePct` values for the nonempty set of pre-retirement working years, with no rounding stated; this formula is the ordinary-average convention implied by the field name and comment and must be checked against the engine.

## Justification

For `n>0` working-year rates `r_i`, an average giving every represented working year equal weight is `r_bar=(sum r_i)/n`; it is not a dollar-weighted ratio because the summary publishes the per-year rates as its input series. The extract does not state behavior for an empty series, so that case is outside this worksheet's valid domain.

## Inputs

| Year | Savings rate | Unit |
|---|---:|---|
| 2026 | 10 | percentage points |
| 2027 | 20 | percentage points |
| 2028 | 35 | percentage points |

## Arithmetic

`sum r_i = 10 + 20 + 35 = 65` percentage points. `n=3`. `r_bar=65/3=21.6666666666667%`.

## Expected

Average pre-retirement savings rate `21.6666666666667%`, absolute tolerance `1e-12` percentage points, derived from one floating-point division with no specified output rounding.

## Wrong readings

- Dividing by four calendar boundaries rather than three represented working years gives `16.25%`.
- Taking the terminal working-year rate rather than the mean gives `35%`.

## Family

outputs: `projection-summary-average-pre-retirement-savings-rate-pct`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
