## Claim

Kind: composition. `projection/internal/types/cashFlow.ts#YearCashFlowCashIdentityTotals`, `#YearCashFlowUseIdentityTotals`, and `#YearCashFlowTransferIdentityTotals` state three annual identities. Cash sources equal cash destinations within `$0.005`; requested uses equal funded plus unfunded uses within `$0.000001`; and transfer debits equal transfer credits within `$0.000001`. Each published `differencePlanDollars` is the left total minus the right total.

## Justification

The cash type comments give every subtotal formula and define fourteen kinds as the closed use vocabulary. The five cash-destination members partition those kinds, so the cash destination total and the use identity's funded-use total are the same sum by construction. `projection/annualCashFlowCapture.ts` assigns cash conservation the annual-funding tolerance and use/transfer reconciliation the structural tolerance; comparisons fail only when absolute difference is strictly greater than the applicable tolerance.

## Inputs

One annual line set, in nominal Plan dollars:

| Source line role | Amount |
|---|---:|
| `spendableSource` | 65,000.000 |
| `portfolioFunding` | 25,000.004 |
| `loanProceeds` | 10,000.000 |

| Use line kind | Requested | Funded | Unfunded |
|---|---:|---:|---:|
| `requiredLifestyle` | 30,000.000000 | 30,000.000000 | 0.000000 |
| `targetLifestyle` | 11,000.000000 | 10,000.000000 | 1,000.000000 |
| `idealLifestyle` | 6,000.000000 | 5,000.000000 | 1,000.000000 |
| `excessLifestyle` | 2,000.000000 | 2,000.000000 | 0.000000 |
| `oneTimeGoal` | 6,000.000000 | 5,000.000000 | 1,000.000000 |
| `debtService` | 6,000.000000 | 6,000.000000 | 0.000000 |
| `propertyCosts` | 4,000.000000 | 4,000.000000 | 0.000000 |
| `healthcare` | 5,000.000000 | 5,000.000000 | 0.000000 |
| `insurancePremium` | 2,000.000000 | 2,000.000000 | 0.000000 |
| `longTermCare` | 1,000.000000 | 1,000.000000 | 0.000000 |
| `settledTax` | 12,000.000000 | 12,000.000000 | 0.000000 |
| `earlyWithdrawalPenalty` | 1,000.000000 | 1,000.000000 | 0.000000 |
| `contribution` | 7,000.000000 | 7,000.000000 | 0.000000 |
| `surplusInvestment` | 10,000.000000 | 10,000.000000 | 0.000000 |

Every use line has `requested = funded + unfunded`.

| Transfer line | Debit | Credit |
|---|---:|---:|
| Qualified charitable distribution | 5,500.000000 | 5,500.000000 |
| Employee contribution | 7,000.000000 | 7,000.000000 |
| Surplus investment | 10,000.000000 | 10,000.000000 |

## Arithmetic

Cash source subtotals are spendable sources `$65,000.000`, portfolio funding `$25,000.004`, and loan proceeds `$10,000.000`. Source total:

`$65,000.000 + $25,000.004 + $10,000.000 = $100,000.004`.

Funded household uses are the sum of the first ten use kinds:

`$30,000 + $10,000 + $5,000 + $2,000 + $5,000 + $6,000 + $4,000 + $5,000 + $2,000 + $1,000 = $70,000`.

The other cash-destination members are settled tax `$12,000`, penalties `$1,000`, contributions `$7,000`, and surplus investment `$10,000`. Destination total:

`$70,000 + $12,000 + $1,000 + $7,000 + $10,000 = $100,000`.

Cash difference:

`$100,000.004 - $100,000 = $0.004`.

Use requested total:

`$30,000 + $11,000 + $6,000 + $2,000 + $6,000 + $6,000 + $4,000 + $5,000 + $2,000 + $1,000 + $12,000 + $1,000 + $7,000 + $10,000 = $103,000`.

Use funded total, summing the funded field over the same fourteen lines:

`$30,000 + $10,000 + $5,000 + $2,000 + $5,000 + $6,000 + $4,000 + $5,000 + $2,000 + $1,000 + $12,000 + $1,000 + $7,000 + $10,000 = $100,000`.

That funded total equals the cash destination total because the destination's five members partition the same fourteen funded fields. Unfunded total:

`$0 + $1,000 + $1,000 + $0 + $1,000 + $0 + $0 + $0 + $0 + $0 + $0 + $0 + $0 + $0 = $3,000`.

Use disposition total and difference:

`$100,000 + $3,000 = $103,000`; `$103,000 - $103,000 = $0`.

Transfer debit total and credit total are each:

`$5,500 + $7,000 + $10,000 = $22,500`.

Transfer difference:

`$22,500 - $22,500 = $0`.

## Expected

- Cash identity at the annual-funding cash tolerance of `$0.005`: spendable sources `$65,000.000`, portfolio funding `$25,000.004`, loan proceeds `$10,000.000`, source total `$100,000.004`; funded household uses `$70,000.000`, settled tax `$12,000.000`, penalties `$1,000.000`, contributions `$7,000.000`, surplus investment `$10,000.000`, destination total `$100,000.000`; difference `$0.004`. It is accepted because `abs($0.004) <= $0.005`.
- Use identity at the structural tolerance of `$0.000001`: requested total `$103,000.000000`, funded total `$100,000.000000`, unfunded total `$3,000.000000`, disposition total `$103,000.000000`, difference `$0.000000`. The funded total exactly equals the cash destination total.
- Transfer identity at the structural tolerance of `$0.000001`: debit total `$22,500.000000`, credit total `$22,500.000000`, difference `$0.000000`.
- Because rejection uses strict `>` rather than `>=`, a difference exactly `$0.005` is accepted for cash and a difference exactly `$0.000001` is accepted for use or transfer.

## Wrong readings

- Giving the use identity a funded-use total of `$90,000` while the cash destination total is `$100,000`, as in the first derivation. The closed use vocabulary makes both totals the sum of the same fourteen funded fields, so they cannot differ for one year's line set.
- Rejecting a difference exactly at its tolerance bound. The checker rejects only when the absolute difference is strictly greater than the applicable bound.
- Applying the `$0.000001` structural tolerance to the cash identity and rejecting the `$0.004` residual. Cash uses the annual-funding cash tolerance of `$0.005`, so the residual is accepted.
- Omitting a funded use kind from one side. The five destination members cover all fourteen use kinds: the first ten feed funded household uses, and the final four feed settled tax, penalties, contributions, and surplus investment.
- Subtracting unfunded uses from funded uses. Disposition is funded plus unfunded, so it is `$103,000`, not `$97,000`.
- Adding transfer debits and credits. They are paired sides; the identity compares `$22,500` of debits with `$22,500` of credits.

## Family

outputs: `cash-flow-reconciliation-totals`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 identity-total doc-comment completion), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-five.md in this directory (the re-check section named "Re-check, 2026-09-18 (reconciliation totals after the identity-total comment completion)").

Revision note: the first derivation stated a destination total larger than the funded-use total it equals by construction, found by the implementation's fixture.
