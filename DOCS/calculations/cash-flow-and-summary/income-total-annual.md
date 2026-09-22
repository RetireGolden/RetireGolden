## Claim

Kind: composition. `projection/internal/types/yearLedger.ts#YearIncomes.total` is the annual cash-income total implied by the published members: `wages + socialSecurity + pension + annuity + tipsLadder + recurring + oneTime + taxableYield + taxExemptInterest`. The separately published `taxableInterest`, `ordinaryDividends`, and `qualifiedDividends` characterize `taxableYield` and do not join the sum again.

## Justification

The member list is inferred from the `YearIncomes` shape together with the cash-flow source-kind comments. Those comments map the seven stream members to `incomes.*` and identify distributed `taxableYield` and cash-real `taxExemptInterest` as spendable sources. The interest and dividend fields are character components of taxable-account yield and must not be counted again.

## Inputs

| Published year-row component | Value | Unit |
|---|---:|---|
| `incomes.wages` | 48,000 | nominal dollars/year |
| `incomes.socialSecurity` | 18,000 | nominal dollars/year |
| `incomes.pension` | 9,000 | nominal dollars/year |
| `incomes.annuity` | 3,000 | nominal dollars/year |
| `incomes.tipsLadder` | 2,000 | nominal dollars/year |
| `incomes.recurring` | 4,000 | nominal dollars/year |
| `incomes.oneTime` | 6,000 | nominal dollars/year |
| `incomes.taxableInterest` | 700 | nominal dollars/year |
| `incomes.ordinaryDividends` | 800 | nominal dollars/year |
| `incomes.qualifiedDividends` | 1,500 | nominal dollars/year |
| `incomes.taxableYield` | 3,000 | nominal dollars/year |
| `incomes.taxExemptInterest` | 500 | nominal dollars/year |

## Arithmetic

`$48,000 + $18,000 + $9,000 + $3,000 + $2,000 + $4,000 + $6,000 + $3,000 + $500 = $93,500`.

The three interest/dividend character fields contribute `$0` beyond the already-counted `taxableYield`.

## Expected

Exact value: `incomes.total = $93,500`. Fixture tolerance: absolute `$0.005`, because the ledger publishes unrounded binary-floating-point dollar sums and accepts a half-cent annual funding residual.

## Wrong readings

- Excluding tax-exempt interest because it is not ordinary income produces `$93,000`.
- Excluding taxable yield because it is separately published produces `$90,500`.
- Adding the `$700 + $800 + $1,500` character components on top of taxable yield produces `$96,500`.

## Family

outputs: `income-total-annual`.

feeds: `portfolio-need-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-five.md in this directory (the member list was confirmed against the engine by the orchestrator before the review).
