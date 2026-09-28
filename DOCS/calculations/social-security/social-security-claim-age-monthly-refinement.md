## Claim

Kind: model. `decisions/claimAgeSweep.ts#refineClaimAgeMonthly` refines the sweep's whole-year winner to the month on the sweep's own objective, and publishes the refined claim, `estateChangeVsWinner` (the refined ending after-tax estate minus the winner's) and `primaryChangeVsWinner` (the objective's own difference), both signed and unrounded.

The search is `#refineClaimMonths`: starting from the winner (every open claim at its whole year, months 0) and its ranked row, for each open claim in household order, every claim from a year below that claim's pick to a year above it, 62 to 70, none below the age reached in the start year, months 0 to 11 except 70, which is only 70y0m; the other claims stay at the running best. Each month is priced through `decisions/evaluateCandidate.ts#evaluateCandidate` against the plan as entered and ranked alone by the sweep's objective policy (`decisions/tournament.ts#rankEvaluations`, margin 0). A month replaces the incumbent only when its row is **eligible** under the policy's constraints and its primary metric is **strictly greater**. A month that ranks higher but breaks a constraint is counted (`rejectedIneligibleBetter`) and not taken.

New 2026-09-28 (B2-P1 slice 5, owner decision R12). Until then planner-ui's `ssAnalysis.ts#refineClaimingMonthly` kept the month with the highest ending after-tax estate whatever objective ranked the sweep, and never checked the objective's constraints.

## Justification

No statute governs the search. Rule 3 decides it: a refinement of the pick "best by X" must be ranked by X, and a month that fails X's own hard constraints (money lasting as long, the estate floor) cannot replace a pick that meets them. The months and the 70y0m cap are the claim factor's (`cfr-20-404-410`, `cfr-20-404-313`, `usc-42-402-worker-claim-window-62-to-70`).

## Inputs

R-A: one open claim, a person aged 60 in the start year, whose whole-year winner is 69y0m with primary metric 100, eligible, ending estate 500. The months priced return:

| Month | Primary | Eligible | Estate |
|---|---:|---|---:|
| 68y5m | 130 | no | 900 |
| 68y9m | 120 | yes | 400 |
| 69y7m | 90 | yes | 800 |
| 70y0m | 60 | yes | 700 |
| any other | 0 | yes | 0 |

## Arithmetic

The pass tries 68y0m to 68y11m (12 months), 69y0m to 69y11m (12) and 70y0m (1): 25 prices. 68y5m ranks higher than 100 but is ineligible: rejected. 68y9m is eligible and 120 > 100: taken. Nothing after it beats 120 (69y7m's 90, 70y0m's 60). The pick is 68y9m: primary +20, estate 400 − 500 = −100. The retired estate climb would have taken 68y5m (estate 900, the ineligible month), then kept it.

## Expected

| Case | Expected |
|---|---|
| R-A pick years | 68 |
| R-A pick months | 9 |
| R-A primary change | 20 |
| R-A estate change | -100 |
| R-A rejected ineligible better | 1 |
| R-A months priced | 25 |

Tolerance: exact.

## Wrong readings

- Keeping the highest estate under another objective (the retired refinement): under bridge durability it undid the objective's pick by $55k to $120k of estate on four example plans, and on R-A it takes the ineligible 68y5m.
- Taking a month that ranks higher but breaks a constraint (15 such months on the example plans at 4a80669e, all under lifetime tax).
- Reading "no month ranks higher" as "optimal to the month": one pass per claim within a year of the pick is searched.

## Family

outputs: `social-security-claiming-sweep-objective`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 5 derivation (worksheet `social-security-claiming-sweep-objective.md`, case R-A, by hand); independently checked (evidence/b2p1-slice5-check.md, item 4). Implemented by: claude (opus 5.5), 2026-09-28. Reviewed by: not yet reviewed.
