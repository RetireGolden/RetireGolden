## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.expenses.debtService`, planned by `projection/internal/annualDebtAndLongTermCare.ts#annualDebtServiceRows`, applies the stated per-debt grow-then-pay convention: grow the opening balance by annual interest, then pay the whole grown balance in `payoffYear`, otherwise pay `min(12 × monthlyPayment, grown balance)`. This exact formula is derived from that convention; the annual total is the sum of the per-debt payments.

## Justification

Interest is applied before payment, a scheduled payoff replaces the level payment, and a normal level payment cannot exceed the balance then due.

## Inputs

| Plan input | Debt A | Debt B | Unit |
|---|---:|---:|---|
| Opening balance | 10,000 | 1,000 | nominal dollars |
| Interest rate | 12 | 12 | percent/year |
| Monthly payment | 500 | 100 | nominal dollars/month |
| Current year | 2030 | 2030 | year |
| `payoffYear` | null | 2030 | year or null |

## Arithmetic

Debt A grows to `$10,000 × 1.12 = $11,200`; its level payment is `min($6,000, $11,200) = $6,000`, leaving `$5,200`. Debt B grows to `$1,000 × 1.12 = $1,120`; because 2030 is its payoff year, it pays `$1,120` and leaves `$0`. Total debt service `= $6,000 + $1,120 = $7,120`.

## Expected

Exact value: `expenses.debtService = $7,120`. Fixture tolerance: absolute `$0.005`, because interest growth and the ordered dollar fold use binary floating point.

## Wrong readings

- Paying before growing produces `$6,000 + $1,000 = $7,000`.
- Treating Debt B's payoff as the ordinary `$1,200` annual payment produces `$7,200` and overpays its `$1,120` balance.
- Ignoring `payoffYear` and using Debt B's capped ordinary payment happens to pay `$1,120` here, but it is the wrong rule and fails when the annual payment is below the grown balance.

## Family

outputs: `spending-debt-service-annual`.

feeds: `spending-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (approved with a note that the rule was stated to the deriver rather than by a doc comment; the comment patch closes it).
