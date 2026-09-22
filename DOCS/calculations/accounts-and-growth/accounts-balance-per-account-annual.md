## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.balances`, materialized by `projection/internal/annualSnapshot.ts#annualSnapshot`, is the year-end per-id map written in this order: logical investable balances, property values, ordinary debt balances, then permanent-life cash values; a later channel overwrites an equal id. Each value is its channel's own full-year figure.

## Justification

At zero return, an investable close is opening plus contributions minus withdrawals. Property and debt enter at their separately determined year-end values; the map does not net unlike channels together.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Investable id / opening | acct-1 / 100,000 | id / dollars |
| Contributions / withdrawals / return | 10,000 / 15,000 / 0 | dollars / dollars / percent |
| Property id / opening / appreciation | home-1 / 200,000 / 3 | id / dollars / percent |
| Debt id / opening / principal amortized | debt-1 / 30,000 / 4,000 | id / dollars / dollars |
| Permanent-life policies | none | count |

## Arithmetic

`acct-1 = $100,000 + $10,000 - $15,000 = $95,000`. `home-1 = $200,000 × 1.03 = $206,000`. `debt-1 = $30,000 - $4,000 = $26,000`. Thus `balances = { "acct-1": 95000, "home-1": 206000, "debt-1": 26000 }`.

Overwrite identity: if all four channels instead used id `shared` with respective year-end values `$95,000`, `$206,000`, `$26,000`, and `$8,000`, the final map entry would be `shared: $8,000` because insurance is written last.

## Expected

Exact values: `acct-1` `$95,000`; `home-1` `$206,000`; `debt-1` `$26,000`. Fixture tolerance: absolute `$0.005`, because year-end dollar figures may be computed in binary floating point.

## Wrong readings

- Applying property appreciation to the account gives `acct-1 = $97,850` rather than `$95,000`.
- Recording debt as a negative asset gives `debt-1 = -$26,000`; the entry is the debt channel's balance, `$26,000`.
- First-write-wins in the collision example leaves `shared = $95,000`; the stated later-channel overwrite order leaves `$8,000`.

## Family

outputs: `accounts-balance-per-account-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eleven.md in this directory.
