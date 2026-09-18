## Claim

Kind: composition. `projection/relocation.ts#computeDrivers` publishes each destination-state driver saving in nominal lifetime dollars as the sum of state-plus-local tax with that one feature neutralized minus the sum actually modeled, with public-pension savings fixed at zero when the state uses one shared retirement rule.

## Justification

For driver `d`, the exact attribution identity is `savings_d=sum_y(tax_neutralized(d,y)-tax_actual(y))`; changing one feature at a time makes this an attribution, not an additive decomposition guaranteed to sum to total tax, and the comment explicitly allows capital-gains savings to be negative. Valid inputs are accepted annual tax inputs with complete recomputations; no result is claimed for unmodeled or flat-override rows whose `drivers` is null.

## Inputs

| Year | Actual tax | SS neutralized | Retirement exclusions neutralized | Public-pension law neutralized | Capital-gains treatment neutralized | Unit |
|---|---:|---:|---:|---:|---:|---|
| 2026 | 5,000 | 5,600 | 5,900 | 5,250 | 4,900 | nominal dollars |
| 2027 | 6,000 | 6,700 | 6,900 | 6,300 | 5,950 | nominal dollars |

## Arithmetic

SS saving `=(5600-5000)+(6700-6000)=$1,300`. Retirement-exclusion saving `=(5900-5000)+(6900-6000)=$1,800`. Separate public-pension saving `=(5250-5000)+(6300-6000)=$550`. Capital-gains-treatment saving `=(4900-5000)+(5950-6000)=-$150`.

## Expected

Expected driver values are exactly SS `$1,300.00`, retirement exclusions `$1,800.00`, separate public pension `$550.00`, and capital-gains treatment `-$150.00`, with exact-cent tolerance because all recomputed tax inputs are exact dollars here.

## Wrong readings

- Reversing the counterfactual subtraction gives `-$1,300`, `-$1,800`, `-$550`, and `+$150`.
- Summing the four attributions and reporting `$3,500` as total tax treats overlapping one-at-a-time counterfactuals as an additive partition, which the identity does not claim.

## Family

outputs: `relocation-state-tax-driver-savings`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
