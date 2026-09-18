## Claim

Kind: model. `decisions/spendingSolver.ts#solveMaxSustainableSpending` finds a lower-bound maximum feasible annual base spending in today's dollars using deterministic integer-dollar bracketing and bisection, where feasibility means no depletion and nominal ending after-tax estate at least the inflated today-dollar floor.

## Justification

Given a monotone feasible predicate over spending, bisection preserves a feasible lower bound and infeasible upper bound. The result is conditional on the ledger, horizon, estate constraint, resolution, and budget; it is not a universal safe-spending guarantee.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Independent feasible boundary | spending `<= $63,000` | today's dollars/year |
| Initial bracket | $60,000 feasible / $70,000 infeasible | today's dollars/year |
| Current base spending | $40,000 | today's dollars/year |
| Resolution | $1,000 | dollars/year |

## Arithmetic

Midpoint `$65,000` is infeasible → `[60,000,65,000]`; `$62,500` feasible → `[62,500,65,000]`; integer midpoint `$63,750` infeasible → `[62,500,63,750]`; `$63,125` infeasible → `[62,500,63,125]`. Width `$625<=1,000`; feasible lower bound is `$62,500`. Spending slack `=62,500-40,000=22,500` today's dollars/year.

## Expected

`maxBaseAnnual=$62,500`, `spendingSlackDollars=$22,500`, `converged=true`; tolerance exact dollars for integer probes and spending slack.

`simulationCount` is not derivable from the stated contract.

## Wrong readings

- Returning the infeasible upper bound gives `$63,125`.
- Averaging the final bracket gives `$62,812.50`, which was never established feasible and violates integer-dollar probing.

## Family

`sustainable-spending-result-max-base-annual`, `sustainable-spending-result-spending-slack-dollars`, `sustainable-spending-result-simulation-count`, `solved-initial-withdrawal-rate-pct`, `solved-spending-rounded-to-hundred`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory (first review and the addendum for the cases added on 2026-09-18).

Revision note: The current-base-spending case was added on 2026-09-18 so the worksheet exercises the published `spendingSlackDollars` output.
