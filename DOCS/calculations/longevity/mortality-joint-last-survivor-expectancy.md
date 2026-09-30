## Claim

Kind: formula. `montecarlo/mortality.ts#jointLastSurvivorExpectancy` computes remaining years until both independent lives are dead as `0.5 + sum(t>=1)[1-(1-Sa(t))(1-Sb(t))]`, each S read from the survival curve from that life's floored age (`survival-probability-product`: for 'average' the mean of the male and female curves), without rounding.

Revision 2026-09-27 (decision D-LIFE-TABLE-2023): the survivals are read from the survival curve on SSA's published 2023 q instead of a product of the identity's q on the 2022 e(x), so 'average' is the mixture.

## Justification

At future integer time `t`, at least one life remains with probability `1-P(A dead)P(B dead)` under independence. Summing those survival indicators gives curtate expectation; adding one half applies the within-year death convention. Population independence is an assumption and can understate shared household hazards. The expectancy is bilinear in the two curves, so for two 'average' lives, each independently a man or a woman with probability 1/2, it is the average over the four equally likely sex pairings.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Both lives | male, age 118 | age/sex |
| SSA male `q(118)` (2023), `q(119)` as the engine reads it | 0.882480, 1 | probability |
| Second case | man of 70 and woman of 67; and the same ages with both 'average' | age/sex |

## Arithmetic

One-year survival for either man at 118 is `1-0.88248=0.11752`. Both are dead after one year with probability `0.88248^2=0.7787709504`, so at least one survives with probability `0.2212290496`. The closed last row forces later survival to zero. Expectancy `=0.5+0.2212290496=0.7212290496` years.

Ages are floored, so two men of 118.7 and 118.2 are two men of 118. A negative age survives with certainty until it reaches 0 and then follows the curve from 0: a man at −2 with a man of 118 gives 0.5 + 1 + 1 + (the sum of the man-from-0 survivals to ages 1 to 118, since the man of 118 is dead from t = 2) = 77.7922910558519, in exact arithmetic.

A man of 70 and a woman of 67 (the Treas. Reg. 1.72-5(b)(2) example's ages): the sum over t = 1..120 on the 2023 curves gives 21.80655867930931 years. With both 'average', 21.52705755500049, exactly the mean of the four pairings (man-man, man-woman, woman-man, woman-woman), against 21.573215393942213 for "an opposite-sex couple, order unknown", the mean of the two mixed pairings. Computed in exact rational arithmetic from the printed columns.

## Expected

| Case | Value |
|---|---:|
| Two men of 118 | 0.7212290496 |
| One-year survival of a man of 118 | 0.11752 |
| Man of 70, woman of 67 | 21.80655867930931 |
| Two 'average' lives of 70 and 67 | 21.52705755500049 |
| Two men of 118.7 and 118.2 (floored ages) | 0.7212290496 |
| A man at age −2 and a man of 118 | 77.7922910558519 |

Tolerance: 1e−12 absolute for the men of 118 (floored or not); 1e−12 relative for the others. Two 'average' lives equal the mean of the four pairings within 1e−12 relative.

## Wrong readings

- Using single-life survival gives `0.5+0.11752=0.61752` years for the men of 118.
- Adding the two survival probabilities without subtracting their overlap gives `0.5+0.23504=0.73504` years.
- For two 'average' lives, the opposite-sex reading gives 21.5732 years instead of 21.5271.
- A negative age read as age 0 at once, without the two years of certain survival: 75.79299793872565 instead of 77.7922910558519.

## Family

none yet — the census does not expose joint remaining-life expectancy directly. The joint-and-survivor annuity exclusion multiple (`projection/annuityForms.ts#annuityExclusionMultiple`) reads it, so `income-annuity-annual` is fed.

## Revision

2026-09-27 (D-LIFE-TABLE-2023): the men-of-118 case was 0.5784 years on the 2022 e(x) rows (one-year survival (0.54 − 0.5)/(0.50 + 0.5) = 0.04 by the identity); the 70/67 and 'average' cases are new.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.

Revision 2026-09-27: restated by claude (opus 5.5) from the D-LIFE-TABLE-2023 derivation (section 8.2: the joint of two men of 118) and its independent check (F2: the couple meaning of 'average'; F5: the 70/67 joint expectancy, 21.8066) (both in RetireGolden-Docs, `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-derivation.md` and `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-check.md`, at commit `75e1cf87`); every value above recomputed in exact rational arithmetic from the printed columns, importing nothing from the engine; not yet reviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-3-longevity-ladders-taxes.md`.
