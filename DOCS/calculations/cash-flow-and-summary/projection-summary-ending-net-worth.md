## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` republishes `ProjectionResult.endingNetWorth`, the nominal-dollar net worth at the projection horizon, without stated rounding.

## Justification

The identity is `summary.endingNetWorth = result.endingNetWorth`; the result type already defines annual net worth as investable plus property, insurance cash value and ladder value, less debt and non-recourse-capped HECM loans, so the summary must not rebuild that ledger identity. The valid domain is any completed `ProjectionResult` with a finite ending value.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| `ProjectionResult.endingNetWorth` | 812,345.67 | nominal dollars |
| `ProjectionResult.endingInvestable` (discriminator only) | 438,765.43 | nominal dollars |

## Arithmetic

`ProjectionSummary.endingNetWorth = $812,345.67`.

## Expected

Ending net worth is exactly `$812,345.67`, with exact-cent tolerance because the composition only copies the supplied endpoint.

## Wrong readings

- Substituting ending investable produces `$438,765.43`.
- Adding ending investable to the already composed net worth double-counts assets and produces `$1,251,111.10`.

## Family

outputs: `projection-summary-ending-net-worth`.

feeds: `projection-summary-ending-after-tax-estate`, `scenario-comparison-cell`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-slice-seven.md in this directory.
