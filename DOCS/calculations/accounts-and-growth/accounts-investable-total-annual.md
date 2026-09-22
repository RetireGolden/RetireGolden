## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.investableTotal` equals the sum of every investable account balance at year end—cash, taxable, equity compensation, traditional, Roth, and HSA accounts—plus unassigned cash. Property, debts, insurance cash value, and TIPS-ladder value are not members; `netWorth` adds them.

## Justification

The corrected field comment explicitly defines the total as every year-end investable account balance and gives the member list: cash, taxable, equity compensation, traditional, Roth, and HSA accounts, plus unassigned cash. It explicitly excludes property, debts, insurance cash value, and the TIPS ladder, while the `netWorth` comment shows that net worth adds those separate asset and liability channels.

## Inputs

| Published year-end balance component | Value | Unit |
|---|---:|---|
| Cash accounts | 15,000 | nominal dollars |
| Taxable accounts | 120,000 | nominal dollars |
| Traditional accounts | 300,000 | nominal dollars |
| Roth accounts | 90,000 | nominal dollars |
| HSA accounts | 25,000 | nominal dollars |
| Unassigned cash | 2,000 | nominal dollars |
| Equity compensation | 40,000 | nominal dollars |
| Insurance cash value | 12,000 | nominal dollars |
| TIPS-ladder value | 30,000 | nominal dollars |

## Arithmetic

`$15,000 + $120,000 + $300,000 + $90,000 + $25,000 + $2,000 + $40,000 = $592,000`.

The seven members are cash accounts, taxable accounts, traditional accounts, Roth accounts, HSA accounts, unassigned cash, and equity compensation. Insurance cash value and ladder value contribute `$0` to `investableTotal`.

## Expected

Exact value: `investableTotal = $592,000`. Fixture tolerance: absolute `$0.005`, because the ledger adds floating-point balances and the tolerance admits less than half a cent of representation error without accepting a one-cent discrepancy.

## Wrong readings

- Omitting equity compensation produces `$552,000`.
- Adding insurance cash value produces `$604,000`.
- Adding the ladder value produces `$622,000`.

## Family

outputs: `accounts-investable-total-annual`.

feeds: `accounts-net-worth-annual`; `projection-result-ending-investable`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 investableTotal doc-comment correction), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-five.md in this directory (the first review, and the re-check section after the comment correction).

Revision note: The first derivation followed a field comment that omitted equity compensation; a read of the engine found the omission.
