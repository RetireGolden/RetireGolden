## Claim

Kind: composition. `projection/compare.ts#summarizeProjection` computes nominal ending after-tax estate as horizon net worth minus the amount passing to charity and minus the total assumed heir income tax on inherited pre-tax balances: `endingAfterTaxEstate = endingNetWorth - endingEstateToCharity - endingEstateHeirTax`.

## Justification

The corrected comments define the metric as ending net worth after both charity carve-outs and heir income tax: `endingAfterTaxEstate = endingNetWorth - endingEstateToCharity - endingEstateHeirTax`. Charity carve-outs pass untaxed rather than remaining in the heirs' estate, so they are subtracted from this figure even though they are also reported separately in `endingEstateToCharity`. With no charity destination, the identity collapses to ending net worth minus heir tax. The valid domain is a completed horizon summary whose component dollar amounts are finite.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Ending net worth | 812,345.67 | nominal dollars |
| Ending estate heir tax | 73,210.11 | nominal dollars |
| Ending amount to charity | 25,000.00 | nominal dollars |

## Arithmetic

`$812,345.67 - $25,000.00 - $73,210.11 = $714,135.56`.

With no charity destination: `$812,345.67 - $0.00 - $73,210.11 = $739,135.56`.

## Expected

Ending after-tax estate is exactly `$714,135.56` to the cent, with absolute tolerance `$0.005` because the inputs are stated to cents and binary floating point may carry a sub-cent residual.

In the second case with no charity destination, ending after-tax estate is exactly `$739,135.56` to the cent under the same absolute `$0.005` tolerance. This is the collapsed identity: net worth minus heir tax.

## Wrong readings

- Ignoring charity when it is `$25,000.00` gives `$739,135.56`.
- Adding heir tax instead of subtracting it gives `$860,555.78` after the charity subtraction.
- Subtracting charity a second time through the heir tax gives `$689,135.56`.

## Family

outputs: `projection-summary-ending-after-tax-estate`.

feeds: `swr-rule-result-ending-after-tax-estate`, `scenario-comparison-cell`, `insight-spending-headroom-rough-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment corrections) and the orchestrator's contract statement, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-slice-seven.md in this directory.

Revision note: The first derivation assumed the identity subtracted heir tax only; pull-request review of #720 found that assumption.
