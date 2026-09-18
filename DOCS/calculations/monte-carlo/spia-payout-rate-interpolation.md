## Claim

Kind: data. `decisions/spiaQuotes.ts#spiaPayoutRate` linearly interpolates annual life-only SPIA payout-rate fractions between age anchors and clamps below age 60 or above age 85; no output rounding is stated after the table's source-side 0.1-percentage-point rounding down.

## Justification

Primary source cited by the extract: annuity.org's April 2026 `$100,000` monthly-payout table, accessed 2026-07-15; anchors use the female column conservatively. Exact embedded anchors are age/rate `60/.060, 65/.070, 70/.084, 75/.103, 80/.129, 85/.153`; age 85 is extrapolated, not quoted. Linear interpolation is a planning convention. Rights note: facts and small numeric extracts are restated with attribution; no source prose/table is reproduced.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Start age | 67.5 | years |
| Neighbor anchors | age 65: 0.070; age 70: 0.084 | annual payout/premium |
| Premium | 100,000 | dollars |

## Arithmetic

`t=(67.5-65)/5=1/2`; rate `=.070+(1/2)(.084-.070)=.077`. Annual payout `=100,000(.077)=$7,700`.

## Expected

Rate `0.077` and illustrative annual payout `$7,700`, absolute tolerance `1e-12` for the rate.

## Wrong readings

- Nearest lower anchor gives `0.070` and `$7,000`.
- Interpreting `0.077` as 0.077% gives `$77`.

## Family

`annuitization-payout-rate-pct`, `annuitization-sweep-annual-income`, `annuitization-sweep-premium` upstream.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
