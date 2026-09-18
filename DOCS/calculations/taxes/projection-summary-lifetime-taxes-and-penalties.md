## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` sums nominal `YearResult.tax + YearResult.penalties` across every projection year to publish lifetime taxes and penalties, with no stated rounding.

## Justification

The result type states that penalties are separate from `tax`, while the summary comment requires both over the whole projection; therefore `L=sum_y(tax_y+penalties_y)`. The valid domain is a finite projection-year sequence with finite annual dollar fields.

## Inputs

| Year | Tax | Penalties | Unit |
|---|---:|---:|---|
| 2026 | 12,000.00 | 300.00 | nominal dollars |
| 2027 | 9,500.25 | 0.00 | nominal dollars |
| 2028 | 8,000.00 | 1,200.50 | nominal dollars |

## Arithmetic

Tax total `=$12,000.00+$9,500.25+$8,000.00=$29,500.25`. Penalty total `=$300.00+$0.00+$1,200.50=$1,500.50`. Combined `=$29,500.25+$1,500.50=$31,000.75`.

## Expected

Lifetime taxes and penalties are exactly `$31,000.75`, with exact-cent tolerance because the calculation is addition of cent-valued ledger fields.

## Wrong readings

- Summing taxes only gives `$29,500.25`.
- Adding penalties only in the final year gives `$30,700.75`.

## Family

outputs: `projection-summary-lifetime-taxes-and-penalties`.

feeds: `swr-rule-result-lifetime-taxes-and-penalties`, `scenario-comparison-cell`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
