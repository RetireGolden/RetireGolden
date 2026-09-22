## Claim

Kind: formula. `projection/compare.ts#ProjectionSummary.endingEstateToCharity` is the sum over accounts whose resolved estate destination is charity of `gross ending balance × min(1, charityPct / 100)`. Non-charity destinations contribute zero.

## Justification

The charity share is applied to the pre-carveout gross model value and passes untaxed; the remainder follows the non-spouse-heir treatment but does not change this field.

## Inputs

| Account | Destination | Gross ending balance | Charity percent | Unit |
|---|---|---:|---:|---|
| Traditional A | charity | 100,000 | 25 | nominal dollars / percent |
| Taxable B | charity | 50,000 | 100 | nominal dollars / percent |
| Roth C | spouse | 40,000 | n/a | nominal dollars |

## Arithmetic

Traditional A charity amount `= $100,000 × min(1, 25/100) = $25,000`. Taxable B `= $50,000 × min(1, 100/100) = $50,000`. Roth C `= $0`. Total `= $75,000`.

## Expected

Exact value: `endingEstateToCharity = $75,000`. Fixture tolerance: absolute `$0.005`, because percentage multiplication and the fold use binary floating point.

## Wrong readings

- Applying 25% to every account produces `$47,500`.
- Including the Roth spouse destination at 100% produces `$115,000`.
- Treating `25` as a decimal rather than a percent produces `$2,500,000` for Traditional A before the required cap.

## Family

outputs: `estate-to-charity`.

feeds: `none yet`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
