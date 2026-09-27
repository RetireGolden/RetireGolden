## Claim

Kind: model. `decisions/spendingSolver.ts#solveMaxSustainableSpending` finds a lower-bound maximum feasible annual base spending in today's dollars using deterministic integer-dollar bracketing and bisection, where feasibility means no depletion and nominal ending after-tax estate at least the inflated today-dollar floor.

## Justification

Given a monotone feasible predicate over spending, bisection preserves a feasible lower bound and infeasible upper bound. The result is conditional on the ledger, horizon, estate constraint, resolution, and budget; it is not a universal safe-spending guarantee.

Monotone feasibility is assumed at fixed-target spending only. Under an adaptive spending policy (guardrails) it does not hold, so the answer is a level the search found feasible and a higher feasible level can exist. Measured with no Marketplace year at all: the example-couple plan with no Marketplace premium or credit, withdrawal-rate guardrails (upper 125%) and an $86,400 required floor depletes in 2059 at a base of $164,391 and never depletes at $166,971, because the higher base makes its first cut a year earlier (2030 against 2031). The independent check of 2026-09-26 also found it on Marketplace plans, under both the gross-premium and the credit-priced ledgers.

A Marketplace year whose premium tax credit the ledger could not price (`aca.readiness` `nonActionable`) counts its full premium, as the ledger funds it; the credit lies between 0 and that premium (26 U.S.C. 36B(b)(2)). The solver always evaluates its probes with `nonActionableAca: 'disclose'` (its options leave callers no way to ask for `'refuse'`), so such a year is a disclosed limit, not a refusal. Those years of the run the result rests on (the best feasible probe, else the seed), the codes that blocked pricing and `acaGrossPremiumDirection` are published, and the last diagnostic names them.

`acaGrossPremiumDirection` is `'conservative'` only at fixed-target spending: at fixed spending a lower premium lowers what that year must withdraw, so a credit would likely leave room to spend more. That is measured, not proven for every plan: an independent check priced the stand-in years in a counterfactual and re-solved the 20 fixed-target example answers at $1 resolution (about 6,700 grid points) without finding a credit-priced answer below the gross one (gaps 0 to $6,357 a year). Under guardrails it is `'uncertain'`: a lower cost keeps the withdrawal rate under the upper guardrail longer, so cuts start later, and the same check found credit-priced ledgers that solve lower (the aggressive-saver example under 125/90/20 guardrails with raises: $76,707 on the gross premium, $75,170 with the credit priced) or deplete at the gross answer (the barista-fire example under the same 125/90/20 guardrails with raises).

When the seed is infeasible, the downward bracket starts at the required spending floor (`expenses.requiredAnnual` rounded up, 0 when the plan has none), the lowest level the plan checks accept; no probe goes below it. The worked example below has a feasible seed, no floor, no Marketplace year and fixed-target spending, so none of these paragraphs changes it.

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

Revision, 2026-09-26 (the nothing-silent decision of 2026-09-25): implemented by claude-subagent. The paragraphs on non-monotone guardrail feasibility, unpriced ACA years and their direction, and the required spending floor were added to the justification: the solver used to refuse every plan with an unpriced Marketplace year and to probe 0 below a required floor, and now answers on the gross-premium ledger, says which way a credit would move the answer, and probes the floor. The monotonicity counterexample was found by the independent check of the derivation and reproduced here on a plan with no Marketplace year. The additions were derived by Claude from the derivation of 2026-09-26. The claim, its formula and the worked example are codex's and unchanged, so the record keeps derivedBy codex with implementedBy claude-subagent, as RetireGolden #746 recorded its Cholesky record; where #746 had a Claude instance restate a claim (reversed history), the record read derivedBy claude, which is what the simulation-count record here does. The catalog requires the reviewer to be a different agent family from the author of the change, so the record is unreviewed until a Codex or Cursor review. The worked example, its expected values and its evidence are unchanged.
