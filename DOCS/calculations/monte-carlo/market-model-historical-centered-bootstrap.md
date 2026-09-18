## Claim

Kind: model. `montecarlo/marketModels.ts#createHistoricalModel` samples embedded annual stock/bond/inflation rows and centers each sampled blended return on `meanPortfolioReturnPct(equityWeightPct)`. It accepts neither a sampled return nor a centering mean. With `mode: 'iid'`, equity weight 60, and the first `nextInt(96)` result equal to 0, path year 1 uses the 1928 row; its inflation is published as-is.

## Justification

Centering on the mean of all embedded blended returns makes the historical shocks mean zero while retaining each sampled row's joint return/inflation observation. This does not claim history repeats or that a 60/40 blend fits every portfolio.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Mode | `iid` | sampling mode |
| Equity weight | 60 | percent |
| First integer draw | 0 of 96 | row index |
| Selected row | 1928: stocks 43.8, bonds 0.8, inflation -1.2 | percent |

## Arithmetic

For every row, blend `= 0.01(60)(stocksPct) + 0.01(40)(bondsPct)`. The sum of all 96 blended returns in table order is `857.9800000000002`; therefore `meanPortfolioReturnPct(60) = 857.9800000000002 / 96 = 8.937291666666669%`.

The 1928 blend is `0.6(43.8) + 0.4(0.8) = 26.599999999999998%`. Centered shock `= 26.599999999999998 - 8.937291666666669 = 17.662708333333327` percentage points. Inflation remains `-1.2%`.

## Expected

Path year 1 has return shock `17.662708333333327` percentage points with absolute tolerance `1e-12`, and inflation equal to the sampled row's `-1.2%`. The non-integer blend and shock are floating-point results, not exact decimal equalities.

## Wrong readings

- Supplying the 1928 return or an `8%` centering mean invents inputs absent from `HistoricalModelConfig`.
- Subtracting a round `8` gives `18.599999999999998`, not the dataset-centered shock.
- Returning the raw `26.599999999999998` as the centered shock fails to subtract the dataset mean.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment corrections) and the orchestrator's contract statements, without executing the engine or reading any implementation body. Reviewed by: unreviewed.

Revision: the first derivation incorrectly treated an independently supplied mean as a model input instead of deriving the mean from every embedded row.
