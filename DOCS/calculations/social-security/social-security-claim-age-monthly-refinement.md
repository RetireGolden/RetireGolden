## Claim

Kind: model. `decisions/claimAgeSweep.ts#refineClaimAgeMonthly` refines the sweep's whole-year winner to the month on the sweep's own objective, and publishes the refined claim, `estateChangeVsWinner` (the refined ending after-tax estate minus the winner's) and `primaryChangeVsWinner` (the objective's own difference), both signed and unrounded.

The search is `#refineClaimMonths`: starting from the winner (every open claim at its whole year, months 0) and its ranked row, for each open claim in the canonical people order (`model/peopleOrder.ts`: older first, then sex, then id; never list order), every claim from a year below that claim's pick to a year above it, 62 to 70, none below the age reached in the start year, months 0 to 11 except 70, which is only 70y0m; the other claims stay at the running best. Whole passes repeat, each window staying around the starting whole year, until a pass changes no claim, at most 5 (`CLAIM_MONTH_REFINEMENT_MAX_PASSES`), so the answer is a fixed point of the search, whichever person is listed first (decision D-PEOPLE-ORDER, rule R7). A combination already priced is not priced again: the count of months priced is the count of distinct combinations, and the rejected count is of distinct months. Each month is priced through `decisions/evaluateCandidate.ts#evaluateCandidate` against the plan as entered and ranked alone by the sweep's objective policy (`decisions/tournament.ts#rankEvaluations`, margin 0). A month replaces the incumbent only when its row is **eligible** under the policy's constraints and its primary metric is **strictly greater**. A month that ranks higher but breaks a constraint is counted (`rejectedIneligibleBetter`) and not taken.

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

R-B: two open claims, p1 and p2, both aged 60 in the start year, whose whole-year pick is 66y0m each. Write a claim's month index as its months since 65y0m (0 to 35 over the window 65y0m to 67y11m). The objective is coupled, every month eligible: primary = min(i1, i2 + 3) + min(i2, i1 + 3). The winner's primary is min(12, 15) + min(12, 15) = 24.

## Arithmetic

The pass tries 68y0m to 68y11m (12 months), 69y0m to 69y11m (12) and 70y0m (1): 25 prices. 68y5m ranks higher than 100 but is ineligible: rejected. 68y9m is eligible and 120 > 100: taken. Nothing after it beats 120 (69y7m's 90, 70y0m's 60). The pick is 68y9m: primary +20, estate 400 − 500 = −100. The retired estate climb would have taken 68y5m (estate 900, the ineligible month), then kept it.

R-B. Pass one: p1, with p2 at index 12, first reaches the greatest primary at i1 = 15 (15 + 12 = 27), 66y3m; p2, with p1 at 15, at i2 = 18 (15 + 18 = 33), 66y6m. Each pass moves each claim six months further along the ridge: pass two 66y9m and 67y0m (primary 45), pass three 67y3m and 67y6m (57), pass four 67y9m and 67y11m, the window's end (i1 = 33, i2 = 35: 33 + 35 = 68), and pass five moves p1 to 67y11m (35 + 35 = 70) and leaves p2. That is the fifth pass, the last one allowed, and it is also the fixed point: a sixth would change nothing. Primary change 70 − 24 = 46. The distinct combinations priced over the five passes are 335. Visiting p2 first gives the same pick. Worked by a separate script that re-implements the statement (C:/rgwt/staging/order-diag/impl/worksheets/claim_month_rb.py).

## Expected

| Case | Expected |
|---|---|
| R-A pick years | 68 |
| R-A pick months | 9 |
| R-A primary change | 20 |
| R-A estate change | -100 |
| R-A rejected ineligible better | 1 |
| R-A months priced | 25 |
| R-B pick years | 67 |
| R-B pick months | 11 |
| R-B primary change | 46 |
| R-B months priced | 335 |

Tolerance: exact.

## Wrong readings

- Keeping the highest estate under another objective (the retired refinement): under bridge durability it undid the objective's pick by $55k to $120k of estate on four example plans, and on R-A it takes the ineligible 68y5m.
- Taking a month that ranks higher but breaks a constraint (15 such months on the example plans at 4a80669e, all under lifetime tax).
- Reading "no month ranks higher" as "optimal to the month": only the months within a year of the pick are searched.
- One pass in household order, the search as #758 moved it into the engine: on R-B it stops at 66y3m and 66y6m (primary 33); two passes stop at 66y9m and 67y0m (45); a window that follows the incumbent instead of the starting year runs past the window to 68y3m and 68y6m.

## Family

outputs: `social-security-claiming-sweep-objective`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 5 derivation (worksheet `social-security-claiming-sweep-objective.md`, case R-A, by hand); independently checked (evidence/b2p1-slice5-check.md, item 4). Implemented by: claude (opus 5.5), 2026-09-28. Reviewed by: not yet reviewed.

Revision 2026-09-29 (decision D-PEOPLE-ORDER, rule R7, carried into the engine when the people-order branch merged main): the claims are visited in the canonical people order and whole passes repeat to a fixed point, as the planner's refinement did before #758 moved it here; a combination priced once is not priced again, so R-A's counts are unchanged. Case R-B added by claude (Opus 5.5). Reviewed by: unreviewed.
