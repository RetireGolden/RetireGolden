## Claim

Kind: composition. `decisions/swrComparator.ts#compareSwrRules` republishes the rule run's nominal `ProjectionSummary.lifetimeTaxesAndPenalties` as the taxes-and-penalties result for that constant-real spending rule, without another aggregation.

## Justification

The upstream summary already sums all annual taxes and penalties, so the exact identity is `SwrRuleResult.lifetimeTaxesAndPenalties=summary.lifetimeTaxesAndPenalties`; re-summing or excluding penalties would change the published quantity. The domain is a completed rule run with a finite summary value.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Summary lifetime tax | 112,500.00 | nominal dollars |
| Summary lifetime penalties | 2,750.25 | nominal dollars |
| Summary lifetime taxes and penalties | 115,250.25 | nominal dollars |

## Arithmetic

Select the already aggregated value: `$115,250.25`.

## Expected

SWR lifetime taxes and penalties are exactly `$115,250.25`, with exact-cent tolerance because this step copies the supplied summary value.

## Wrong readings

- Publishing tax alone gives `$112,500.00`.
- Adding the separately displayed penalty amount to the already combined summary gives `$118,000.50`.

## Family

outputs: `swr-rule-result-lifetime-taxes-and-penalties`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-slice-seven.md in this directory.
