## Claim

Kind: composition. `decisions/swrComparator.ts#compareSwrRules` republishes the rule run's nominal `ProjectionSummary.endingAfterTaxEstate` as that rule's ending after-tax estate, without further discounting or recomputation.

## Justification

The comparator runs the variant plan, summarizes that exact result and publishes the summary field, so the identity is `SwrRuleResult.endingAfterTaxEstate=summary.endingAfterTaxEstate`; estate tax discounting belongs to the upstream summary and must not be applied twice. The domain is a completed rule run with a finite summary value.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Rule-run ending net worth (discriminator only) | 700,000.00 | nominal dollars |
| Rule-run ending after-tax estate | 640,000.00 | nominal dollars |
| Rule-run heir-tax discount (discriminator only) | 60,000.00 | nominal dollars |

## Arithmetic

Select the already composed value: `$640,000.00`.

## Expected

SWR ending after-tax estate is exactly `$640,000.00`, with exact-cent tolerance because this step copies the supplied summary value.

## Wrong readings

- Publishing ending net worth gives `$700,000.00`.
- Subtracting heir tax a second time gives `$580,000.00`.

## Family

outputs: `swr-rule-result-ending-after-tax-estate`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
