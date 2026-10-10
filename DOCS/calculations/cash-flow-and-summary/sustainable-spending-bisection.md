## Claim

Kind: model. `decisions/spendingSolver.ts#solveMaxSustainableSpending` finds a lower-bound maximum feasible annual base spending in today's dollars using deterministic integer-dollar bracketing and bisection, where feasibility means no depletion and nominal ending after-tax estate at least the inflated today-dollar floor. It publishes the highest level that passed as `feasibleBaseAnnual`, a whole number of today's dollars, and the published answer `maxBaseAnnual` as that level rounded down to $100 when that level is known to pass (worksheet `spending-and-withdrawals/solved-spending-rounded-to-hundred.md`).

## Justification

Given a monotone feasible predicate over spending, bisection preserves a feasible lower bound and infeasible upper bound. The result is conditional on the ledger, horizon, estate constraint, resolution, and budget; it is not a universal safe-spending guarantee.

Monotone feasibility is assumed at fixed-target spending only. Under an adaptive spending policy (guardrails) it does not hold, so the answer is a level the search found feasible and a higher feasible level can exist. Measured with no Marketplace year at all: the example-couple plan with no Marketplace premium or credit, withdrawal-rate guardrails (upper 125%) and an $86,400 required floor depletes in 2059 at a base of $164,391 and never depletes at $166,971, because the higher base makes its first cut a year earlier (2030 against 2031). The independent check of 2026-09-26 also found it on Marketplace plans, under both the gross-premium and the credit-priced ledgers.

A Marketplace year whose premium tax credit the ledger could not price (`aca.readiness` `nonActionable`) counts its full premium, as the ledger funds it; the credit lies between 0 and that premium (26 U.S.C. 36B(b)(2)). The solver always evaluates its probes with `nonActionableAca: 'disclose'` (its options leave callers no way to ask for `'refuse'`), so such a year is a disclosed limit, not a refusal. Those years of the run the result rests on (the best feasible probe; with no answer, the probe the failure diagnostic describes: the floor probe when it ran, else the seed), the codes that blocked pricing and `acaGrossPremiumDirection` are published, and the last diagnostic names them.

`acaGrossPremiumDirection` is `'conservative'` only at fixed-target spending: at fixed spending a lower premium lowers what that year must withdraw, so a credit would likely leave room to spend more. That is measured, not proven for every plan: an independent check priced the stand-in years in a counterfactual and re-solved the 20 fixed-target example answers at $1 resolution (about 6,700 grid points) without finding a credit-priced answer below the gross one (gaps 0 to $6,357 a year). Under guardrails it is `'uncertain'`: a lower cost keeps the withdrawal rate under the upper guardrail longer, so cuts start later, and the same check found credit-priced ledgers that solve lower (the aggressive-saver example under 125/90/20 guardrails with raises: $76,707 on the gross premium, $75,170 with the credit priced) or deplete at the gross answer (the barista-fire example under the same 125/90/20 guardrails with raises).

The seed is the base spending rounded to a whole dollar, raised to the required spending floor (`expenses.requiredAnnual` rounded up) when it would fall below it. When the seed is infeasible, the downward bracket starts at that floor (0 when the plan has none), the lowest level the plan checks accept; no probe goes below it. The worked example below has a feasible seed, no floor, no Marketplace year and fixed-target spending, so none of these paragraphs changes it.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Independent feasible boundary | spending `<= $63,000` | today's dollars/year |
| Initial bracket | $60,000 feasible / $70,000 infeasible | today's dollars/year |
| Current base spending | $40,000 | today's dollars/year |
| Resolution, case 1 | $1,000 | dollars/year |
| Resolution, case 2 | $100 | dollars/year |

Case 2 is case 1 with the resolution lowered to $100: the same boundary, the same current base and the same initial bracket, so the search runs on past the bracket where case 1 stops. No required spending floor, no Marketplace year and fixed-target spending in both.

## Arithmetic

Midpoint `$65,000` is infeasible → `[60,000,65,000]`; `$62,500` feasible → `[62,500,65,000]`; integer midpoint `$63,750` infeasible → `[62,500,63,750]`; `$63,125` infeasible → `[62,500,63,125]`. Width `$625<=1,000`; feasible lower bound is `$62,500`. Spending slack `=62,500-40,000=22,500` today's dollars/year.

How the search reaches the initial bracket: the seed probe is the current base, `$40,000`, which is feasible; the first doubling probe is `max(2 × 40,000, 20,000) = $80,000`, infeasible, so the bracket is `[40,000, 80,000]`; its integer midpoints `$60,000` (feasible) and `$70,000` (infeasible) leave `[60,000, 70,000]`, the bracket above.

The integer midpoint is the half-sum rounded to the nearest dollar with a half rounded up (`Math.round((lower + upper) / 2)` in `solveMaxSustainableSpending`); every half-sum in case 1 is a whole number, so case 1 does not depend on that rule.

Case 2 continues from `[62,500, 63,125]`, whose width `$625` exceeds `$100`: the half-sum `62,812.5` rounds up to `$62,813`, feasible, so `[62,813, 63,125]`; width `$312`, midpoint `$62,969`, feasible, so `[62,969, 63,125]`; width `$156`, midpoint `$63,047`, infeasible, so `[62,969, 63,047]`; width `$78 <= 100`, so the search stops, converged. The highest level that passed is `feasibleBaseAnnual = $62,969`. It is not a whole $100, and the plan spends at a fixed target with no floor, so `maxBaseAnnual = floor(62,969 / 100) × 100 = $62,900`, and the slack is measured from it: `62,900 - 40,000 = $22,900`. In case 1 the level that passed, `$62,500`, is already a whole $100, so both figures are `$62,500`.

## Expected

| Quantity | Case 1 | Case 2 |
|---|---:|---:|
| feasibleBaseAnnual | 62,500 | 62,969 |
| maxBaseAnnual | 62,500 | 62,900 |
| spendingSlackDollars | 22,500 | 22,900 |
| converged | true | true |
| Probes after the initial bracket | 65,000; 62,500; 63,750; 63,125 | 65,000; 62,500; 63,750; 63,125; 62,813; 62,969; 63,047 |

Today's dollars a year. Tolerance: exact; every probe and every published figure is a whole number of dollars.

`simulationCount` has its own record, `sustainable-spending-result-simulation-count`, which states the count; this record feeds that family.

## Wrong readings

- Returning the infeasible upper bound gives `$63,125`.
- Averaging the final bracket gives `$62,812.50`, which was never established feasible and violates integer-dollar probing.
- Publishing the rounded answer as the level that passed gives `feasibleBaseAnnual = $62,900` in case 2.
- Returning the infeasible upper bound gives `$63,047` in case 2.
- Flooring the half-sum instead of rounding a half up probes `$62,812`, `$62,968` and `$63,046` in case 2 and ends at `$62,968`.
- Rounding the answer to the nearest $100 instead of down gives `maxBaseAnnual = $63,000` in case 2, above the level that passed.

## Family

outputs: `sustainable-spending-result-max-base-annual`, `sustainable-spending-result-spending-slack-dollars`, `sustainable-spending-result-feasible-base-annual`.

feeds: `sustainable-spending-result-simulation-count`, `solved-initial-withdrawal-rate-pct`, `solved-spending-rounded-to-hundred`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory (first review and the addendum for the cases added on 2026-09-18).

Revision note: The current-base-spending case was added on 2026-09-18 so the worksheet exercises the published `spendingSlackDollars` output.

Revision, 2026-09-26 (the nothing-silent decision of 2026-09-25): implemented by claude-subagent. The paragraphs on non-monotone guardrail feasibility, unpriced ACA years and their direction, and the required spending floor were added to the justification: the solver used to refuse every plan with an unpriced Marketplace year and to probe 0 below a required floor, and now answers on the gross-premium ledger, says which way a credit would move the answer, and probes the floor. The monotonicity counterexample was found by the independent check of the derivation and reproduced here on a plan with no Marketplace year. The additions were derived by Claude from the derivation of 2026-09-26. The claim, its formula and the worked example are codex's and unchanged, so the record keeps derivedBy codex with implementedBy claude-subagent, as RetireGolden #746 recorded its Cholesky record; where #746 had a Claude instance restate a claim (reversed history), the record read derivedBy claude, which is what the simulation-count record here does. The catalog requires the reviewer to be a different agent family from the author of the change, so the record was unreviewed until the review below. The worked example, its expected values and its evidence are unchanged.

Revision, 2026-09-27 (B2-P1 slice 2, owner decision R4): the level this search finds is now published as `feasibleBaseAnnual`, and the published answer `maxBaseAnnual` is that level rounded down to $100 when that level is known to pass (worksheet `spending-and-withdrawals/solved-spending-rounded-to-hundred.md`, record `solved-spending-rounding`). This worksheet's answer, $62,500, is already a whole $100, so its expected values are unchanged. The mutation receipt was rewritten onto the line that now holds the answer.

Reviewed by: Grok (grok-4.7), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-grok-1.md`.

Revision, 2026-10-10 (D-MCP-CENSUS-PIN): `feasibleBaseAnnual` is now a family of its own, `sustainable-spending-result-feasible-base-annual`, because RetireGolden-MCP publishes it (`solve_max_spending.feasibleBaseAnnual`, since 0.11.0), and this record lists it in its outputs. Restated by claude (Opus 5.5) from `decisions/spendingSolver.ts#solveMaxSustainableSpending`: the claim now names both published figures, the arithmetic says how the search reaches the initial bracket and which integer midpoint it takes, and case 2, in which the level that passed is not a whole $100, is added with its expected values and four wrong readings. Case 1's figures are unchanged. The evidence asserts `feasibleBaseAnnual` in both cases, and the mutation receipt was re-executed against the extended evidence. The record's provenance keeps its original derivation (codex), implementation (claude-subagent) and record-level review (grok): Codex derived the record, so it cannot be its record-level reviewer, as with `rmd-uniform-lifetime-divisor` and `income-annuity-annual`. This restatement is Claude's, so Codex reviews it, and that review is recorded below.

Reviewed by: Codex (GPT-6-Sol), 2026-10-10, the 2026-10-10 restatement (case 2 recomputed, case 1 unchanged), `DOCS/calculations/reviews/REVIEW-2026-10-10-census-completion-codex.md` (approved). The record-level reviewer stays Grok, since Codex derived the record.
