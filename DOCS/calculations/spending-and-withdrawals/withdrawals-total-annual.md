## Claim

Kind: composition. `projection/internal/types/yearLedger.ts#YearWithdrawals.total` equals `cash + taxable + traditional + roth + hsa` for the published year row. Each forced inherited dollar is in exactly one category: traditional for an inherited traditional account and roth for an inherited Roth account, the taxable earnings of a non-qualified inherited Roth distribution included (decision D-INHERITED-ROTH-SLICE, 2026-09-25). The worksheet's year carries no inherited account.

## Justification

The `YearWithdrawals` comment identifies these as withdrawal totals by account category, and the requested ledger contract explicitly states that their five members compose `total`. Until decision D-INHERITED-ROTH-SLICE the `YearWithdrawals.total` comment named one departure, an inherited-Roth earnings slice counted in `traditional` as well as `roth`; the decision moved that slice out of `traditional`, and the comment now states the identity without exception.

## Inputs

| Published year-row component | Value | Unit |
|---|---:|---|
| `withdrawals.cash` | 4,000 | nominal dollars/year |
| `withdrawals.taxable` | 11,000 | nominal dollars/year |
| `withdrawals.traditional` | 18,000 | nominal dollars/year |
| `withdrawals.roth` | 7,000 | nominal dollars/year |
| `withdrawals.hsa` | 2,000 | nominal dollars/year |

## Arithmetic

`$4,000 + $11,000 + $18,000 + $7,000 + $2,000 = $42,000`.

## Expected

Exact value: `withdrawals.total = $42,000`. Fixture tolerance: absolute `$0.005`, because the ledger sums unrounded binary-floating-point dollar fields.

## Wrong readings

- Omitting HSA withdrawals produces `$40,000`.
- Subtracting Roth withdrawals as if they were a tax offset produces `$28,000`.

## Family

outputs: `withdrawals-total-annual`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-five.md in this directory.

Revision note (2026-09-22, pull-request review of #729): the Claim and Justification now state the documented D-INHERITED-ROTH-SLICE departure under which the five categories exceed the total in a year with a non-qualified inherited Roth distribution; the derived year has no inherited account and no value changed.

Amended 2026-09-25 by claude, the implementer of decision D-INHERITED-ROTH-SLICE: the decision removed that departure (the Roth earnings slice now stays in `roth`), so the Claim and Justification state the identity without exception. The derived year has no inherited account and no value changed; the inherited-Roth year is held by `projection/simulate.inheritedRegimeExecution.test.ts`.
