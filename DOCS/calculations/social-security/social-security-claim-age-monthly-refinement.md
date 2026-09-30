## Claim

Kind: model. `decisions/claimAgeSweep.ts#refineClaimAgeMonthly` refines the sweep's whole-year winner to the month on the sweep's own objective, and publishes the refined claim, `estateChangeVsWinner` (the refined ending after-tax estate minus the winner's) and `primaryChangeVsWinner` (the objective's own difference), both signed and unrounded.

The search is `#refineClaimMonths`: starting from the winner (every open claim at its whole year, months 0) and its ranked row, for each open claim in the canonical people order (`model/peopleOrder.ts`: older first, then sex, then id; never list order), every claim from a year below that claim's pick to a year above it, 62 to 70, none below the age reached in the start year, months 0 to 11 except 70, which is only 70y0m; the other claims stay at the running best. Whole passes repeat, each window staying around the starting whole year, until a pass changes no claim, so the answer is a fixed point of the search, whichever person is listed first (decision D-PEOPLE-ORDER, rule R7), and the search's `passes` counts how many ran, the last changing nothing. There is no pass cap: a pass that changes a claim takes a month whose primary metric is strictly greater than the incumbent's, and a combination's row is fixed once priced, so no combination is the incumbent twice and the passes end within one more than the number of combinations the windows hold. That bound is kept as a guard that throws, never as a stop. A combination already priced is not priced again: the count of months priced is the count of distinct combinations, and the rejected count is of distinct months. Each month is priced through `decisions/evaluateCandidate.ts#evaluateCandidate` against the plan as entered and ranked alone by the sweep's objective policy (`decisions/tournament.ts#rankEvaluations`, margin 0). A month replaces the incumbent only when its row is **eligible** under the policy's constraints and its primary metric is **strictly greater**. A month that ranks higher but breaks a constraint is counted (`rejectedIneligibleBetter`) and not taken.

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

R-C: as R-B with a tighter coupling, primary = min(i1, i2 + 2) + min(i2, i1 + 2). The winner's primary is min(12, 14) + min(12, 14) = 24.

## Arithmetic

The pass tries 68y0m to 68y11m (12 months), 69y0m to 69y11m (12) and 70y0m (1): 25 prices. 68y5m ranks higher than 100 but is ineligible: rejected. 68y9m is eligible and 120 > 100: taken. Nothing after it beats 120 (69y7m's 90, 70y0m's 60). The pick is 68y9m: primary +20, estate 400 − 500 = −100. The retired estate climb would have taken 68y5m (estate 900, the ineligible month), then kept it.

R-B. Pass one: p1, with p2 at index 12, first reaches the greatest primary at i1 = 15 (15 + 12 = 27), 66y3m; p2, with p1 at 15, at i2 = 18 (15 + 18 = 33), 66y6m. Each pass moves each claim six months further along the ridge: pass two 66y9m and 67y0m (primary 45), pass three 67y3m and 67y6m (57), pass four 67y9m and 67y11m, the window's end (i1 = 33, i2 = 35: 33 + 35 = 68), and pass five moves p1 to 67y11m (35 + 35 = 70) and leaves p2. Pass six changes nothing, so the search stops there with the fixed point, after 6 passes; it prices nothing new, since every combination it tries was priced in pass five. Primary change 70 − 24 = 46. The distinct combinations priced are 335. Visiting p2 first gives the same pick. Worked by a separate script that re-implements the statement (claim_month_rb.py, not yet published).

R-C. Each pass moves each claim four months along the ridge: pass one 66y2m and 66y4m (i = 14 and 16, primary 30), pass two 66y6m and 66y8m (38), pass three 66y10m and 67y0m (46), pass four 67y2m and 67y4m (54), pass five 67y6m and 67y8m (62), pass six 67y10m and 67y11m (i = 34 and 35, 69), pass seven p1 to 67y11m (70), and pass eight changes nothing: 8 passes, the sixth and seventh past the old five-pass cap. Primary change 70 − 24 = 46; 455 distinct combinations priced. Visiting p2 first gives the same pick. Worked by a separate script (claim_month_rc.py, not yet published).

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
| R-B passes | 6 |
| R-C pick years | 67 |
| R-C pick months | 11 |
| R-C primary change | 46 |
| R-C months priced | 455 |
| R-C passes | 8 |

Tolerance: exact.

## Wrong readings

- Keeping the highest estate under another objective (the retired refinement): under bridge durability it undid the objective's pick by $55k to $120k of estate on four example plans, and on R-A it takes the ineligible 68y5m.
- Taking a month that ranks higher but breaks a constraint (15 such months on the example plans at 4a80669e, all under lifetime tax).
- Reading "no month ranks higher" as "optimal to the month": only the months within a year of the pick are searched.
- One pass in household order, the search as #758 moved it into the engine: on R-B it stops at 66y3m and 66y6m (primary 33); two passes stop at 66y9m and 67y0m (45); a window that follows the incumbent instead of the starting year runs past the window to 68y3m and 68y6m.
- At most five passes, the cap until the round-one review of #765 (issue 4): R-C stops after pass five at 67y6m and 67y8m (primary change 38), a pick that is not a fixed point, and nothing in the result said so.

## Family

outputs: `social-security-claiming-sweep-objective`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 5 derivation (worksheet `social-security-claiming-sweep-objective.md`, case R-A, by hand); independently checked (evidence/b2p1-slice5-check.md, item 4). Implemented by: claude (opus 5.5), 2026-09-28. Reviewed by: not yet reviewed.

Revision 2026-09-29 (decision D-PEOPLE-ORDER, rule R7, carried into the engine when the people-order branch merged main): the claims are visited in the canonical people order and whole passes repeat to a fixed point, as the planner's refinement did before #758 moved it here; a combination priced once is not priced again, so R-A's counts are unchanged. Case R-B added by claude (Opus 5.5). Reviewed by: unreviewed.

Revision 2026-09-29 (round-one review of #765, issue 4): the five-pass cap is gone, since every changing pass strictly improves the objective over a finite set of combinations and the search therefore always ends at a fixed point; the bound is kept as a guard that throws. The search reports `passes`. R-B now records its confirming sixth pass; case R-C, which needs eight, is added. R-A and R-B's picks and counts are unchanged. Revised by claude (Opus 5.5). Reviewed by: unreviewed.

Revision 2026-09-29 (Codex review, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-1-social-security.md`): the record's timing said up to 25 months per claim per pass, which is R-A's window around a 69 pick; a window runs from a year below the whole-year pick to a year above it, so it holds up to 36 months (R-B's and R-C's 65y0m to 67y11m), 24 for a pick of 62, 25 for 69 and 13 for 70 (`decisions/claimAgeSweep.ts#claimMonthWindow`). No figure here changes. Revised by claude (opus 5.5); unreviewed until the reviewer checks the revision.

Reviewed by: Codex (GPT-6-Sol), 2026-09-30, targeted re-check after the fix, `DOCS/calculations/reviews/REVIEW-2026-09-30-recheck-codex.md`.
