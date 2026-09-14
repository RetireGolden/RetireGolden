## Claim

Kind: model. `ladder/fedInvest.ts#latestPriceDate` and `latestPriceDateIso` select the most recent likely published US business-day price date and format it from local civil-date components, avoiding UTC date rollover.

## Justification

FedInvest prices publish on business-day evenings, so a weekend observation must walk backward to Friday. This is a publication-availability heuristic; the extract does not say it recognizes federal holidays or give the evening cutoff. Primary source endpoints are TreasuryDirect FedInvest, retrieval recorded 2026-09-14. Rights note: only endpoint facts are cited.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Local `now` | Sunday 2026-07-12 12:00 | local civil timestamp |

## Arithmetic

Sunday is not a business day; step back to Saturday (also not), then Friday 2026-07-10. Local components format as `2026-07-10`.

## Expected

Date Friday 2026-07-10 and ISO string `2026-07-10`, exact civil date.

## Wrong readings

- Using the current calendar day returns Sunday `2026-07-12`.
- Using UTC components near a timezone boundary can return `2026-07-11` instead of the local date.

## Family

none yet — FedInvest is an opt-in reference and never replaces embedded planning yields.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.
