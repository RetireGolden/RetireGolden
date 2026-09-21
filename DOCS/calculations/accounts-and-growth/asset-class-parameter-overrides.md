## Claim

Kind: composition. `allocation/assetClasses.ts#resolveAssetClassParams` overlays supplied per-class assumption overrides on the four sourced default parameter records, preserving every absent class and field; returned rates and volatilities remain annual percentage values and qualified ratios remain percent.

## Justification

An override is an explicit user/model assumption and therefore takes precedence only where supplied; replacing an entire class record would erase unrelated defaults. This is parameter resolution, not validation that either default or override predicts future markets.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Default bonds return/volatility | 4.0 / 7.7 | percent/year, percentage points/year |
| Override bonds return | 5.0 | percent/year nominal |
| US-stock default return | 7.0 | percent/year nominal |

## Arithmetic

For bonds, return is present in the override, so resolved return is `5.0`; volatility is absent, so it remains `7.7`. No US-stock override exists, so its return remains `7.0`.

## Expected

Resolved bonds return/volatility `5.0/7.7` and US-stock return `7.0`, exact at the supplied one-decimal precision.

## Wrong readings

- Replacing the whole bonds record makes volatility missing or zero instead of `7.7`.
- Applying the bonds override to every class changes US-stock return to `5.0` instead of `7.0`.

## Family

`accounts-balance-per-account-annual`, `income-taxable-yield-annual`, `monte-carlo-investable-fan-percentiles`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
