## Claim

Kind: formula. `montecarlo/survival.ts#jointSurvivalPercentileAge` returns the oldest primary-clock integer age at which at least one of two independent lives survives with probability at least `pct/100`, using `1-(1-Sa)(1-Sb)`, each S read off that person's survival curve (`survival-probability-product`; for 'average' the mixture). It walks both survival curves while either person is still inside the table (one past its last age), so the answer's calendar year, the primary's birth year plus the answer, is the same whichever person is passed as primary (decision D-PEOPLE-ORDER, rule R6).

Revision 2026-09-27 (decision D-LIFE-TABLE-2023): the survivals are the curve's on SSA's published 2023 q; the answer, 70, is unchanged.

## Justification

Under independence, both are dead with probability `(1-Sa)(1-Sb)`; its complement is last-survivor survival. The primary age clock advances the partner by the same elapsed years. Independence is a model assumption, not an empirical household claim. Two 'average' people are independent mixtures, so the either-alive probability is the average over the four equally likely sex pairings.

The walk used to stop when the primary passed the table's end, even while a partner 25 or more years younger was likely still alive. The ABW `survival25`/`survival10` spending horizon ("couples: either member") was then cut short by up to 55 years at extreme gaps, and by 1 year at a 25-year gap, and it depended on which person was listed first: over every pair of ages from 20 to 100, both sexes and both percentiles, 21,596 of 52,488 pairs gave a different year by order (the independent check's grid, on SSA's 2022 table). Walking both curves to the end of the table leaves none.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Case 1: both people | male, age 65 | age/sex |
| Case 1: threshold | 99 | percent |
| Case 2: primary, partner | male age 70; female age 35 | age/sex |
| Case 2: threshold | 25 | percent |
| Hazard powers | 1, 1 | ratio |
| Start year (for the calendar year) | 2026 | calendar year |

## Arithmetic

**A partner's hazard.** A man of 65 (hazard 1) with a woman of 63 whose hazard power is 1.5: her curve is the product of (1 − q)^1.5 on SSA's female column, and the either-alive probability on his clock reaches 50, 25 and 10 percent last at his ages 89, 93 and 96 (computed in doubles by the implementer's script, importing nothing from the engine). With her hazard left at 1 they would be 91, 95 and 99.

Single-life survival at primary ages 69, 70, 71 is `0.929212164769243`, `0.9093586176567833`, `0.88853157723659` (the product of 1 − q over 65 to 68, 69 and 70 on SSA's 2023 male column, q69 = 0.021366 and q70 = 0.022903). Joint values are respectively `1-(1-S)^2 = 0.9949890823833432`, `0.9917841398069108`, `0.9875747907266377`. Age 70 qualifies and 71 fails.

**Case 2 (a partner 35 years younger).** A man of 70 as primary with a woman of 35, at 25 percent. His survival reaches 0 past the table's last row, primary age 120, when she is 85; her survival, the running product of 1 − q on SSA's 2023 female column, stays at or above 0.25 through t = 56, her age 91, and falls below it at t = 57. With his survival 0 by then, either-alive equals hers, so the last qualifying step is t = 56: primary-clock age 70 + 56 = 126, calendar year 2026 − 70 + 126 = 2082. Passed the other way round (the woman of 35 as primary), the walk stops at her age 91: 2026 − 35 + 91 = 2082. Recomputed in doubles by a separate script that reads only the table's q columns and re-implements the walk (C:/rgwt/staging/order-diag/impl/worksheets/joint_survival_2023.py); the old walk, stopped when the primary passes the table, gives 120 (2076).

## Expected

Case 1: joint percentile age `70`, exact integer (intermediate display values may use absolute tolerance `1e-9`).

Case 2: joint percentile age `126` on the primary's clock, exact integer; calendar year `2082` both ways.

| Age | Single-life survival | Either-alive survival |
|---|---:|---:|
| 69 | 0.929212164769243 | 0.9949890823833432 |
| 70 | 0.9093586176567833 | 0.9917841398069108 |
| 71 | 0.88853157723659 | 0.9875747907266377 |
| A man of 65 with a woman of 63 at hazard 1.5, at 50%, 25%, 10% | 89, 93, 96 | |

## Wrong readings

- Multiplying survivals computes both-alive probability and returns an earlier boundary.
- Using one person's 99th-percentile result returns age `65`, violating the last-survivor construction here.
- Ignoring the partner's hazard power: 91, 95 and 99 instead of 89, 93 and 96 for the man of 65 and the woman of 63 at 1.5.
- Stopping the walk when the primary passes the table's end: case 2 returns 120 (2076), six years early, while the passed-the-other-way answer is 2082.

## Family

outputs: `longevity-survival-percentile-age`.

feeds: `spending-base-annual` (the amortization-based spending policy's survival-percentile horizon, worked out again on every projection).

## Revision

2026-09-27 (D-LIFE-TABLE-2023): the survivals were `0.923392932`, `0.902507417`, `0.879847618` and the either-alive values `0.994131357`, `0.990495196`, `0.985563405` on the 2022 identity.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.

Revision 2026-09-27: restated by claude (opus 5.5) from the D-LIFE-TABLE-2023 derivation (section 7.6: this record's worksheet tests move) and its independent check (both in RetireGolden-Docs, `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-derivation.md` and `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-check.md`, at commit `75e1cf87`); the values above were recomputed in exact rational arithmetic from the printed columns, importing nothing from the engine; not yet reviewed.

Revision 2026-09-28 (decision D-PEOPLE-ORDER, rule R6): the walk continues while either person is inside the table; case 2 added by claude (Opus 5.5) from the independent check's grid (evidence/people-order-check.md, D1-6) and restated on the 2023 table by the script above when the branch took main's life table (126, 2082; on the 2022 table it was 125, 2081). Reviewed by: unreviewed.
