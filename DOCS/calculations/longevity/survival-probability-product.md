## Claim

Kind: formula. `montecarlo/survival.ts#survivalCurve(fromAge, sex, hazard)` is the engine's one survival curve. For a man or a woman, `survivalTo(t)` is the running product of the one-year survivals `(1-q(x))^h` from a whole starting age, multiplied left to right, with q SSA's published death probability (`mortality-published-death-probability`); `deathProbabilityInYear(t)` is `survivalTo(t) × (1 − (1 − q(fromAge + t))^h)`; and `deathProbabilityGivenAlive(t)` is `1 − (1 − q(fromAge + t))^h`, which at h = 1 is q itself. For 'average' the curve is the 50/50 mixture of the man's and the woman's curves from the same starting age, each under the same power h: `survivalTo(t)` is their mean, `deathProbabilityInYear(t)` is `survivalTo(t) − survivalTo(t + 1)`, and `deathProbabilityGivenAlive(t)` is `1 − survivalTo(t + 1)/survivalTo(t)` (1 once `survivalTo(t)` is 0). A fractional age or a hazard that is not a positive finite number is refused. `montecarlo/survival.ts#survivalProbabilityTo` is a view of it from the floored current age; no rounding is stated.

Revision 2026-09-14 and 2026-09-27 (B2-P1 slice 4, "the survival curve defined once in the engine"): the product became `survivalCurve`, and `survivalProbabilityTo` a view of it, the same product in the same order; the Social Security analysis models read the curve.

Revision 2026-09-27 (decision D-LIFE-TABLE-2023): q is SSA's published 2023 column instead of the identity on the 2022 e(x); 'average' is the mixture instead of the identity on the mean of the two e rows; the curve gains `deathProbabilityGivenAlive`; and every reader (the percentile ages, the hazard solver, the death-age draw, the joint expectancy) reads the curve, so no function outside `survival.ts` multiplies (1 − q) itself. For a man or a woman the product is the same product in the same order as before, so given the same q every reader is unchanged to the bit.

## Justification

Conditional one-year survival probabilities multiply along a life path. Raising survival to `h` is exactly the stated proportional-hazards transform because `q'=1-(1-q)^h`. Domain: integer age path within the table and positive finite `h`.

'average': SSA publishes no unisex column, and the plan uses 'average' for a person whose sex it does not state. The survival of a person known to be alive at age a whose sex is male or female with equal probability is S(a→y) = (S_male(a→y) + S_female(a→y))/2. It is the only reading under which every survival probability, and so the life expectancy (0.5 plus the sum of the survivals) and every expected value linear in the curve, is the average of the male and female ones. It is not one q(x) table: its one-year death probability at a later age, 1 − S(a→y + 1)/S(a→y), depends on a, because the survivors of a mixed group become more female with age (at 90: 0.14086 formed at 22, 0.14155 at 65, 0.14327 at 85, against the mean q 0.144317). Ages read off the curve (percentile ages) and hazard powers solved on it are not averages of the male and female ones. The hazard power applies to each sex before mixing: the person is one sex or the other. Two 'average' people are independent mixtures, so anything a couple's two curves feed bilinearly (an expected value, a joint expectancy, an either-alive probability) is the average over the four equally likely sex pairings.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Current/target age | 65 / 67 | years |
| Sex | male; female; 'average' | category |
| Hazard power | 1 | ratio |
| Male `q65`..`q68` (SSA 2023) | 0.016455, 0.017574, 0.018735, 0.019981 | probability |
| Female `q65`..`q68` (SSA 2023) | 0.010188, 0.010880, 0.011659, 0.012543 | probability |
| Male `q117`, `q118` | 0.840457, 0.882480; q = 1 from 119 | probability |

## Arithmetic

Man of 65: `S(1) = 1 − 0.016455 = 0.983545`, `S(2) = 0.983545 × 0.982426 = 0.96626018017`, `S(3) = × 0.981265 = 0.948157295694515`, `S(4) = × 0.980019 = 0.929212164769243`. So `survivalProbabilityTo(65, male, 67) = 0.96626018017`.

Woman of 65: `0.989812`, `0.97904284544`, `0.967628184905015`, `0.9554912245817514`.

'average' of 65, the mean of the two: `0.9866785`, `0.972651512805`, `0.957892740299765`, `0.9423516946754972`. Its probability of dying at 66 given alive at 66 is `1 − S(2)/S(1) = 2805397439/197335700000 = 0.014216370575623164`, not the mean q(66), 0.014227.

Man of 117 (the table end): `S(1) = 1 − 0.840457 = 0.159543`, `S(2) = 0.159543 × (1 − 0.882480) = 0.01874949336`, `S(3) = 0` because the last row is closed. His yearly death probabilities sum to 1.

The view floors a fractional target: `survivalProbabilityTo(65, male, 67.9)` is S(2) = 0.96626018017, not S(3). A curve is read at whole years only: `survivalTo(1.5)` is refused. For 'average' from 118, S(1) = 0.11752 and S(2) = 0 (the closed last row), so the probability of dying in year 2 given alive is 1: nobody is alive to survive it.

The values were computed in exact rational arithmetic from the printed columns; each double survival equals the exact value to 1e−15 relative.

## Expected

The curve's cases:

| Case | Value |
|---|---:|
| Male from 65, survivalTo(1) | 0.983545 |
| Male from 65, survivalTo(2) | 0.96626018017 |
| Male from 65, survivalTo(3) | 0.948157295694515 |
| Male from 65, survivalTo(4) | 0.929212164769243 |
| Female from 65, survivalTo(1) | 0.989812 |
| Female from 65, survivalTo(2) | 0.97904284544 |
| Female from 65, survivalTo(3) | 0.967628184905015 |
| Female from 65, survivalTo(4) | 0.9554912245817514 |
| Average from 65, survivalTo(1) | 0.9866785 |
| Average from 65, survivalTo(2) | 0.972651512805 |
| Average from 65, survivalTo(3) | 0.957892740299765 |
| Average from 65, survivalTo(4) | 0.9423516946754972 |
| Average from 65, dying at 66 given alive | 0.014216370575623164 |
| Male from 117, survivalTo(1) | 0.159543 |
| Male from 117, survivalTo(2) | 0.01874949336 |
| Male from 117, survivalTo(3) | 0 |
| Male from 65 to the target age 67.9 (floored) | 0.96626018017 |
| Average from 118, dying in year 2 given alive (survival 0) | 1 |

`survivalProbabilityTo(65, male, 67)` is `0.96626018017`, absolute tolerance `1e-12`; target age 65 returns exactly `1`. The table's values: 1e−15 relative, except the probability of dying given alive, 1e−13 relative (one minus a ratio of survivals near 1 loses about two digits to cancellation in doubles), and exact for the 0. The yearly death probabilities of each curve sum to 1 within 1e−12. For every whole starting age from 0 to 120 and every t, the 'average' curve is exactly the mean of the male and female curves, and `survivalProbabilityTo` is exactly the curve.

## Wrong readings

- Multiplying through age 67 as well gives `0.948157295694515` (one period too many).
- Adding death probabilities gives `1-q65-q66=0.965971`, missing the product term.
- Rounding a fractional target up: the man of 65 to 67.9 would read S(3) = 0.948157295694515.
- 'average' as the mean of the two q gives `S(2) = (1 − 0.0133215)(1 − 0.014227) = 0.9726410249805` from 65, below the mean of the two survivals, 0.972651512805.

## Family

outputs: none.

feeds: `longevity-survival-percentile-age`; since 2026-09-27 also `social-security-expected-present-value`, `social-security-survivor-switch-pv` and `social-security-fica-return-ratio`, whose models read the curve, `income-annuity-annual` (a joint-and-survivor annuity's joint life expectancy, `mortality-joint-last-survivor-expectancy`, reads it) and `spending-base-annual` (the amortization-based spending policy's survival-percentile horizon, worked out again on every projection).

Revision 2026-09-14: the first derivation also listed `monte-carlo-success-rate` and `monte-carlo-ending-investable-histogram`. The Monte Carlo reaches mortality through the sampled death age, which since 2026-09-27 reads this curve's `deathProbabilityGivenAlive` (`mortality-sampled-death-age` feeds those two families).

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.

Revision 2026-09-27: restated by claude (opus 5.5) for B2-P1 slice 4 from the slice's derivation (`survival-curve.md`) and independent check (B2); not yet reviewed.

Revision 2026-09-27 (D-LIFE-TABLE-2023): restated by claude (opus 5.5) from that decision's derivation (sections 3 and 8.2, whose exact values these are; its scratch engine equals them to 5.6e−16 relative) and independent check (F2: every fixture value and the mixture's properties reproduced in exact arithmetic); the values above were recomputed in exact rational arithmetic from the printed columns, importing nothing from the engine; not yet reviewed. The 2022-identity cases (a man of 65 to 67, 0.963150477964002; a man of 117, 0.08653846153846145 and 0.003461538461538461; a woman of 63 to 67, 0.9580296085257168) are replaced.
