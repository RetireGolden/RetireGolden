## Claim

Kind: formula. `montecarlo/survival.ts#jointSurvivalPercentileAge` returns the oldest primary-clock integer age at which at least one of two independent lives survives with probability at least `pct/100`, using `1-(1-Sa)(1-Sb)`, each S read off that person's survival curve (`survival-probability-product`; for 'average' the mixture).

Revision 2026-09-27 (decision D-LIFE-TABLE-2023): the survivals are the curve's on SSA's published 2023 q; the answer, 70, is unchanged.

## Justification

Under independence, both are dead with probability `(1-Sa)(1-Sb)`; its complement is last-survivor survival. The primary age clock advances the partner by the same elapsed years. Independence is a model assumption, not an empirical household claim. Two 'average' people are independent mixtures, so the either-alive probability is the average over the four equally likely sex pairings.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Both people | male, age 65 | age/sex |
| Threshold | 99 | percent |
| Hazard powers | 1, 1 | ratio |

## Arithmetic

**A partner's hazard.** A man of 65 (hazard 1) with a woman of 63 whose hazard power is 1.5: her curve is the product of (1 − q)^1.5 on SSA's female column, and the either-alive probability on his clock reaches 50, 25 and 10 percent last at his ages 89, 93 and 96 (computed in doubles by the implementer's script, importing nothing from the engine). With her hazard left at 1 they would be 91, 95 and 99.

Single-life survival at primary ages 69, 70, 71 is `0.929212164769243`, `0.9093586176567833`, `0.88853157723659` (the product of 1 − q over 65 to 68, 69 and 70 on SSA's 2023 male column, q69 = 0.021366 and q70 = 0.022903). Joint values are respectively `1-(1-S)^2 = 0.9949890823833432`, `0.9917841398069108`, `0.9875747907266377`. Age 70 qualifies and 71 fails.

## Expected

Joint percentile age `70`, exact integer (intermediate display values may use absolute tolerance `1e-9`).

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

## Family

outputs: `longevity-survival-percentile-age`.

feeds: `spending-base-annual` (the amortization-based spending policy's survival-percentile horizon, worked out again on every projection).

## Revision

2026-09-27 (D-LIFE-TABLE-2023): the survivals were `0.923392932`, `0.902507417`, `0.879847618` and the either-alive values `0.994131357`, `0.990495196`, `0.985563405` on the 2022 identity.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.

Revision 2026-09-27: restated by claude (opus 5.5) from the D-LIFE-TABLE-2023 derivation (section 7.6: this record's worksheet tests move) and its independent check; the values above were recomputed in exact rational arithmetic from the printed columns, importing nothing from the engine; not yet reviewed.
