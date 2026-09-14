## Claim

Kind: model. `decisions/spiaQuotes.ts#QLAC_DEFERRED_PAYOUT_RATE` is a temporary conservative annual payout-rate fraction of `0.16` for a deferred QLAC starting at age 80–85, without interpolation or rounding.

## Justification

The extract explicitly says no direct deferred quote was obtained and marks this as a placeholder to be replaced. It is intended to understate candidates, not to represent a sourced market quote. Rights note: no third-party dataset is copied.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Premium | 100,000 | dollars |
| Placeholder rate | 0.16 | annual payout/premium |

## Arithmetic

Annual payout `=100,000(0.16)=16,000`; monthly equivalent `=16,000/12=1,333.33333333333`.

## Expected

Annual payout `$16,000`, exact cents for the annual figure; monthly illustration tolerance `1e-9` dollars.

## Wrong readings

- Treating 0.16 as 0.16% gives `$160` annually.
- Substituting the age-85 immediate anchor gives `$15,300`, contrary to the distinct placeholder.

## Family

`annuitization-payout-rate-pct`, `annuitization-sweep-annual-income` upstream.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
