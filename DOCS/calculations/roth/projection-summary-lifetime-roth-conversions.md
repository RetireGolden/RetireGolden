## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` sums every projection year's nominal `YearResult.rothConversion` dollars to publish lifetime Roth conversions, with no stated rounding.

## Justification

Each annual field is dollars moved traditional-to-Roth in that year, so lifetime movement is the additive identity `sum_y rothConversion_y` over all and only the projection rows. The domain is a finite projection-year sequence with finite annual amounts.

## Inputs

| Year | Roth conversion | Unit |
|---|---:|---|
| 2026 | 40,000.00 | nominal dollars |
| 2027 | 0.00 | nominal dollars |
| 2028 | 55,500.25 | nominal dollars |

## Arithmetic

`$40,000.00 + $0.00 + $55,500.25 = $95,500.25`.

## Expected

Lifetime Roth conversions are exactly `$95,500.25`, with exact-cent tolerance because this is a finite sum of cent-valued ledger fields.

## Wrong readings

- Omitting the zero-conversion year by shortening the horizon to 2027 also drops 2028 and produces `$40,000.00`.
- Treating conversions as a net change and subtracting the later conversion gives `-$15,500.25`.

## Family

outputs: `projection-summary-lifetime-roth-conversions`.

feeds: `scenario-comparison-cell`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
