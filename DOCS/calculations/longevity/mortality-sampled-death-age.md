## Claim

Kind: model. `montecarlo/mortality.ts#sampleDeathAge` walks integer ages from the current age down the survival curve (`survival-probability-product`), compares one injected uniform draw per year with the curve's probability of dying that year given alive at its start, and returns the last full age alive, deterministically for a fixed RNG stream. For a man or a woman that probability is SSA's published q(x) (`mortality-published-death-probability`); for 'average' it is the 50/50 mixture's, 1 − S(t + 1)/S(t) from the current age, so the drawn age has the mixture's distribution.

Revision 2026-09-27 (decision D-LIFE-TABLE-2023): the walk reads the curve's `deathProbabilityGivenAlive(t)` instead of `annualMortality`, which no longer takes 'average', and q is SSA's published 2023 column instead of the identity on the 2022 e(x). One draw per year, as before, so each path's RNG stream is consumed exactly as it was.

## Justification

Inverse Bernoulli sampling declares death in the age-`x` interval when `U < g`, g the probability of dying that year given alive at its start, and otherwise advances. The probability that the walk returns x0 + t is the product of the survival chances of the years before and the death chance of that year: Π_{j<t} [S(j + 1)/S(j)] × [1 − S(t + 1)/S(t)] = S(t) − S(t + 1), because the product telescopes. So the drawn age has exactly the curve's distribution, for a table sex and for the mixture alike. This uses period-table hazards as if applicable throughout the remaining lifetime and does not predict an individual's death.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Current age | 65 | integer age |
| Sex | male; 'average' | category |
| Male draws at 65, 66 | 0.5, 0.01 | uniform probability |
| 'average' draws at 65, 66, 67 | 0.5, 0.01422, 0 | uniform probability |
| Male `q65`, `q66`, `q67` (SSA 2023) | 0.016455, 0.017574, 0.018735 | probability |
| Female `q65`, `q66`, `q67` (SSA 2023) | 0.010188, 0.010880, 0.011659 | probability |

## Arithmetic

**Male.** At 65, `0.5 >= q65 = 0.016455`, so he survives to 66. At 66, `0.01 < q66 = 0.017574`, so he dies before 67 and the last full year alive is 66. Two draws.

**'average' from 65.** The mixture's survivals are S(1) = (0.983545 + 0.989812)/2 = 0.9866785, S(2) = (0.96626018017 + 0.97904284544)/2 = 0.972651512805 and S(3) = 0.957892740299765. The probabilities of dying given alive are g(0) = 1 − S(1) = 0.0133215 (at the starting age, the mean of the two q), g(1) = 1 − S(2)/S(1) = 2805397439/197335700000 = 0.014216370575623164 and g(2) = 1 − S(3)/S(2) = 0.015173751658158204. The draws: 0.5 >= 0.0133215 (survives 65), 0.01422 >= 0.0142164 (survives 66), 0 < 0.0151738 (dies at 67). Three draws. The mean of the two q at 66 is 0.014227, so reading 'average' as the mean of q would die at 66 on the second draw.

**The distribution.** P(death at 65) = 0.0133215, P(death at 66) = S(1) − S(2) = 0.014026987195, P(death at 67) = S(2) − S(3) = 0.014758772505234954.

**Table end.** From 119 the walk returns 119 at once and consumes no draw. Walking from a younger age, it draws at each age below 119 and none at 119: a man of 117 who survives the draws at 117 and 118 (q = 0.840457 and 0.882480) reaches 119 and is returned there, after two draws, so every later draw on the path is where it would be.

**The age.** The starting age is floored: a man of 65.9 walks from 65, so the draws 0.5 and 0.01 return 66 as for a man of 65.

## Expected

| Case | Value |
|---|---:|
| Male from 65, draws 0.5 and 0.01: death age | 66 |
| 'average' from 65, draws 0.5, 0.01422 and 0: death age | 67 |
| 'average' from 65, dying at 65 given alive | 0.0133215 |
| 'average' from 65, dying at 66 given alive | 0.014216370575623164 |
| 'average' from 65, dying at 67 given alive | 0.015173751658158204 |
| 'average' from 65, P(death at 66) | 0.014026987195 |
| 'average' from 65, P(death at 67) | 0.014758772505234954 |
| From 119: death age, with no draw | 119 |
| Male from 65.9, draws 0.5 and 0.01: death age | 66 |
| Male from 117, surviving both draws: death age | 119 |
| Male from 117, surviving both draws: draws consumed | 2 |

Tolerance: exact for the death ages; 1e−13 relative for the probabilities, each one minus a ratio, or a difference, of survivals near 1, which loses about two digits to cancellation in doubles. The draw's distribution, measured through `sampleDeathAge` itself, equals the curve's `deathProbabilityInYear` at every age for every starting age tested, within 1e−15 absolute.

## Wrong readings

- Returning the next birthday gives `67` for the male case (off by one).
- Testing `U > g` as death would kill the male path at age 65 because `0.5 > 0.016455`, returning `65`.
- 'average' as the mean of the two q (0.014227 at 66): the 'average' draws die at `66`.
- A draw at 119 as well: the man of 117 who survives 117 and 118 consumes a third draw, shifting every later draw on the path.
- The starting age rounded up: a man of 65.9 walks from 66 and dies at 67 on the same draws.

## Family

`monte-carlo-success-rate`, `monte-carlo-ending-investable-histogram`; none has a direct death-age field yet.

## Revision

2026-09-14: Corrected the wrong-reading rule so its stated comparison matches the numbers and the resulting wrong age 65.

2026-09-27 (D-LIFE-TABLE-2023): restated on SSA's published 2023 q (the male q65 and q66 were 0.0179294389820704 and 0.0192655027092113 by the identity on the 2022 e(x); the male death age, 66, is unchanged), with the 'average' mixture case and its distribution added.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.

Revision 2026-09-27: restated by claude (opus 5.5) from the D-LIFE-TABLE-2023 derivation (sections 3.4 and 8.4) and its independent check (F2: the draw's telescoping, and the draws [0.5, 0.01422, 0], reproduced in exact arithmetic) (both in RetireGolden-Docs, `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-derivation.md` and `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-check.md`, at commit `75e1cf87`); the values above were recomputed in exact rational arithmetic from the printed columns, importing nothing from the engine; not yet reviewed at the time.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-3-longevity-ladders-taxes.md`.
