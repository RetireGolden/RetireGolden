## Claim

Kind: model. `decisions/spendingSolver.ts#solveMaxSustainableSpending` finds a lower-bound maximum feasible annual base spending in today's dollars using deterministic integer-dollar bracketing and bisection, where feasibility means no depletion and nominal ending after-tax estate at least the inflated today-dollar floor.

## Justification

Given a monotone feasible predicate over spending, bisection preserves a feasible lower bound and infeasible upper bound. The result is conditional on the ledger, horizon, estate constraint, resolution, and budget; it is not a universal safe-spending guarantee.

A Marketplace year whose premium tax credit the ledger could not price (`aca.readiness` `nonActionable`) counts its full premium, as the ledger funds it. The credit lies between 0 and that premium (26 U.S.C. 36B(b)(2)), so the probe is a conservative feasibility test there, not a refusal. Those years of the run the answer rests on (the best feasible probe, else the seed) and the codes that blocked pricing are published in `acaGrossPremiumYears` and `acaGrossPremiumReasons`. Conservative is measured on the 29 examples, not proven for every ledger: a lower healthcare cost could in principle change later guardrail spending.

When the seed is infeasible, the downward bracket starts at the required spending floor (`expenses.requiredAnnual` rounded up, 0 when the plan has none), the lowest level the plan checks accept; no probe goes below it. The worked example below has a feasible seed and no floor, so neither line changes it.

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

Revision, 2026-09-26 (the nothing-silent decision of 2026-09-25): implemented by claude-subagent. The two paragraphs on unpriced ACA years and the required spending floor were added to the justification: the solver used to refuse every plan with an unpriced Marketplace year and to probe 0 below a required floor, and now answers on the gross-premium ledger and probes the floor. The additions were derived by Claude from the derivation of 2026-09-26; the catalog requires the reviewer to be a different agent family from the author of the change, so the record is unreviewed until a Codex or Cursor review. The worked example, its expected values and its evidence are unchanged.
