## Claim

Kind: formula. `ladder/fedInvest.ts#nearestTipsForYear` selects the TIPS whose maturity calendar year is nearest the requested year, or null from an empty list; the extract does not state a tie rule.

## Justification

The natural distance is absolute calendar-year difference `|maturityYear-targetYear|`, matching the stated “nearest ... year” convention. This is a reference-row match, not CUSIP-level ladder optimization.

## Inputs

| Candidate maturity | Distance from 2033 | Unit |
|---:|---:|---|
| 2030 | 3 | years |
| 2035 | 2 | years |

## Arithmetic

`|2030-2033|=3`; `|2035-2033|=2`; minimum distance is the 2035 TIPS.

## Expected

Select the 2035 record, exact identity.

## Wrong readings

- Selecting only maturities before the target chooses 2030.
- Comparing full ISO strings lexically to `2033` rather than year distance need not select either nearest maturity.

## Family

none yet — FedInvest matching is an opt-in quote reference.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
