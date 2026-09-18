## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` computes nominal ending after-tax estate as horizon net worth minus the total assumed heir income tax on inherited pre-tax balances, with no stated rounding.

## Justification

The comments define the metric as ending net worth net of heir income tax, so the exact identity is `endingAfterTaxEstate = endingNetWorth - endingEstateHeirTax`; charity is separately reported and is not an additional subtraction from this estate total. The valid domain is a completed horizon summary whose component dollar amounts are finite.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Ending net worth | 812,345.67 | nominal dollars |
| Ending estate heir tax | 73,210.11 | nominal dollars |
| Ending amount to charity (discriminator only) | 25,000.00 | nominal dollars |

## Arithmetic

`$812,345.67 - $73,210.11 = $739,135.56`.

## Expected

Ending after-tax estate is exactly `$739,135.56`, with exact-cent tolerance because both inputs and the subtraction are stated to cents.

## Wrong readings

- Subtracting charity as though it were tax gives `$714,135.56`.
- Adding the heir tax produces `$885,555.78`.

## Family

outputs: `projection-summary-ending-after-tax-estate`.

feeds: `swr-rule-result-ending-after-tax-estate`, `scenario-comparison-cell`, `insight-spending-headroom-rough-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
