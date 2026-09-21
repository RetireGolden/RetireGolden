## Claim

Kind: model. `montecarlo/marketModels.ts#createEmpiricalModel` draws from `HISTORICAL_YEARS`; it does not accept a sampled return or a centering mean. At equity weight `w`, centered mode publishes the sampled row's blend minus `meanPortfolioReturnPct(w)`, while raw mode publishes the blend itself. For path year 1 here, `nextInt(96) = 0` selects 1928 and the empirical model's uniform coin of at least `0.6` keeps that initially drawn cursor. Inflation is the sampled row's inflation as-is.

## Justification

The dataset mean, rather than a supplied round number or the plan return assumption, centers the empirical shocks. Raw mode deliberately preserves the empirical level but can double count because the projection adds the plan's expected return separately. Neither mode predicts future returns.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Equity weight | 60 | percent |
| First integer draw | 0 of 96 | row index |
| First uniform coin | at least 0.6 | unit interval |
| Selected row | 1928: stocks 43.8, bonds 0.8, inflation -1.2 | percent |
| `centered` | `true`, then `false` | mode |

## Arithmetic

For every row, blend `= 0.01(60)(stocksPct) + 0.01(40)(bondsPct)`. Summing all 96 row blends in table order gives `857.9800000000002`, so the full-precision dataset mean is `857.9800000000002 / 96 = 8.937291666666669%`.

For 1928, blend `= 0.6(43.8) + 0.4(0.8) = 26.599999999999998%`. Centered shock `= 26.599999999999998 - 8.937291666666669 = 17.662708333333327` percentage points. Raw shock `= 26.599999999999998` percentage points. Inflation `= -1.2%` in either mode.

## Expected

For the selected 1928 row, centered/raw return shocks are `17.662708333333327` and `26.599999999999998` percentage points, each with absolute tolerance `1e-12`; inflation is the row value `-1.2%` in both cases. The non-integer blends and shocks are floating-point results, not exact decimal equalities.

## Wrong readings

- Treating `26.599999999999998` or a centering mean as caller inputs describes values that `EmpiricalModelConfig` does not accept.
- Subtracting a round `8` gives `18.599999999999998`, not the dataset-centered shock.
- Calling raw mode's final ledger return `26.599999999999998%` ignores the plan assumption that the projection adds separately.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment corrections) and the orchestrator's contract statements, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.

Revision: the first derivation incorrectly treated the sampled return and a round centering mean as inputs even though the model accepts neither.
