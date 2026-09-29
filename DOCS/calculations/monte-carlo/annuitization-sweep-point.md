## Claim

Kind: model. `decisions/annuitization.ts#AnnuitizationSweepPoint.premium`, `.annualIncome`, and `.effectiveAllocationPct` use premium `min(gridPct/100 × investable total, 0.95 × funding-account balance)`, skip a point below `$5,000`, multiply an accepted premium by `decisions/spiaQuotes.ts#spiaPayoutRate`, and publish `premium / investable total × 100` as the effective share. The field comments state these identities. The start age is that of the person `model/peopleOrder.ts#canonicalFirstPerson` puts first (the older; between two people born the same day, the sex order female, male, average (`CANONICAL_SEX_ORDER`) and then the smaller id by ordinal comparison decide, so for two people with the same birth date and sex, renaming the ids can move the annuitant and every figure on that life, as it can move a Monte Carlo path (`monte-carlo-people-draw-order`)), whoever is listed first; every sweep annuity is on that person's life and the notes name them (decision D-PEOPLE-ORDER).

## Justification

The default SPIA table anchors are age 60 `6.0%`, 65 `7.0%`, 70 `8.4%`, 75 `10.3%`, 80 `12.9%`, and 85 `15.3%`, with linear interpolation and endpoint clamping. Start age is at least 65.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Total investable | 200,000 | dollars |
| Largest liquid funding account | 100,000 | dollars |
| Requested grid allocation | 60 | percent |
| Current/start age | 72 | years |
| User quote | absent | condition |
| Small-point grid allocation | 2 | percent |

## Arithmetic

Requested premium `= 60% × $200,000 = $120,000`. Funding cap `= 0.95 × $100,000 = $95,000`. Premium `= min($120,000, $95,000) = $95,000`.

At age 72, interpolate between age-70 `0.084` and age-75 `0.103`: rate `= 0.084 + (72-70)/(75-70)(0.103-0.084) = 0.0916`, or `9.16%`. Annual income `= $95,000 × 0.0916 = $8,702`. Effective allocation `= $95,000 / $200,000 × 100 = 47.5%`.

Small point: `2% × $200,000 = $4,000`, below `$5,000`, so the point is skipped.

Couple case (revision 2026-09-28): the same accounts, with Pat (born 1966-06-15, 60 in 2026) listed first and Robin (born 1954-06-15, 72) second. The canonical order puts Robin first, so the start age is 72 and every figure is the single case's: rate `9.16%`, annual income `$8,702`, and the note "Each annuity in the sweep pays on Robin's life from age 72." Listed the other way round, the sweep is the same.

## Expected

Exact values for the retained point: premium `$95,000`; annual income `$8,702`; effective allocation `47.5%`. Fixture tolerance: absolute `$0.005` for dollar figures and absolute `1e-9` percentage points for effective allocation, because interpolation and division use binary floating point. The `$4,000` point is absent exactly.

## Wrong readings

- Ignoring the 95% funding-account cap gives premium `$120,000`, income `$10,992`, and effective allocation `60%`.
- Using the age-70 anchor without interpolation gives income `$95,000 × 0.084 = $7,980`.
- Keeping the `$4,000` point violates the strict under-`$5,000` skip rule.
- Pricing the couple case on the first-listed person, the rule before the decision: start age `max(60, 65) = 65` and the age-65 rate `7.0%`, income `$95,000 × 0.07 = $6,650`.

## Family

outputs: `annuitization-sweep-premium`; `annuitization-sweep-annual-income`; `annuitization-sweep-effective-allocation-pct`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.

Revision 2026-09-28 (decision D-PEOPLE-ORDER): the sweep's person is the canonical first (the older), whoever is listed first; couple case added by claude (Opus 5.5). Reviewed by: unreviewed.

Later the same day (the independent review's L5): the claim states the tie-break past the birth date; with the same birth date and sex, renaming the ids moves the sweep's annuitant and its medians. No figure changes.
