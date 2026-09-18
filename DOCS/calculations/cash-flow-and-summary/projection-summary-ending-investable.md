## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` republishes `ProjectionResult.endingInvestable`, the nominal-dollar investable balance at the projection horizon, without stated rounding.

## Justification

The identity is `summary.endingInvestable = result.endingInvestable`; it selects the whole-run endpoint rather than summing annual rows or selecting the largest annual balance. The valid domain is any completed `ProjectionResult` with a finite ending value.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| `ProjectionResult.endingInvestable` | 438,765.43 | nominal dollars |
| Penultimate annual `investableTotal` (discriminator only) | 472,000.00 | nominal dollars |

## Arithmetic

`ProjectionSummary.endingInvestable = $438,765.43`.

## Expected

Ending investable is exactly `$438,765.43`, with exact-cent tolerance because the composition only copies the supplied dollar value.

## Wrong readings

- Selecting the penultimate annual balance produces `$472,000.00`.
- Adding the endpoint to the penultimate balance produces `$910,765.43`.

## Family

outputs: `projection-summary-ending-investable`.

feeds: `scenario-comparison-cell`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
