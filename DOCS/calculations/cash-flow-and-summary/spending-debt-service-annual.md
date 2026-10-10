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

## A payoff dated before the start year (D-2027-ROLLOVER, review L4)

A payoff year before the projection start year is reached in the first projected year, so the rule above pays the whole grown balance then, the same as a payoff dated in that year. Nothing moves. What changed is that it is no longer silent: the projection names it with the amount the ledger pays (`projection/preStartEvents.ts#preStartEvents`):

> The Mortgage payoff is dated 2026, before this plan starts in 2027, so the plan pays it off in 2027: $190,800, its $180,000 balance with a year of interest. If it was paid, set its balance to $0.

Worked case (the evidence file): Debt B's payoff moved to 2029 in a projection that starts in 2030. The 2030 row pays `1,000 x 1.12 = 1,120`, as for a 2030 payoff, and the warning names `$1,120, its $1,000 balance with a year of interest`. From a 2027 start the reviewer's mortgage with a 2026 payoff moved ending net worth by -$189,695.85 with nothing said.

Restated 2026-09-29 by the implementer of decision D-2027-ROLLOVER (Claude Opus 5.5), after the independent review (RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/rollover-2027-review.md`, finding L4). It was then unreviewed (`reviewedBy: 'unreviewed'`); Grok reviewed the restated record on 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-1.md`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (approved with a note that the rule was stated to the deriver rather than by a doc comment; the comment patch closes it).

Reviewed by: Grok (grok-4.7), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-1.md`.
