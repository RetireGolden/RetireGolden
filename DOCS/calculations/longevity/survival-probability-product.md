## Claim

Kind: formula. `montecarlo/survival.ts#survivalProbabilityTo` returns 1 when target age is not later than current age and otherwise multiplies annual survival probabilities `(1-q(x))^h` over integer ages, where `h` is the proportional-hazards power; no rounding is stated.

Revision 2026-09-27 (B2-P1 slice 4, "the survival curve defined once in the engine"): the product is `montecarlo/survival.ts#survivalCurve(fromAge, sex, hazard)`, whose `survivalTo(t)` is the running product of the same one-year survivals from a whole starting age, multiplied left to right, and whose `deathProbabilityInYear(t)` is `survivalTo(t) × (1 − (1 − q(fromAge + t))^h)`; it refuses a fractional age or a hazard that is not a positive finite number. `survivalProbabilityTo` is a view of it, the same product in the same order, so every percentile age, hazard power and joint expectancy is unchanged to the bit (pinned at every integer pair up to 121 and all three sexes). The Social Security analysis models (the benefits-only expected value, survivor switching and the paid-in ratio) read the curve; planner-ui's copy of it (`socialSecurity/expectedPv.ts#survivalCurve`, which agreed to 7.8e-16 at integer ages) is deleted.

## Justification

Conditional one-year survival probabilities multiply along a life path. Raising survival to `h` is exactly the stated proportional-hazards transform because `q'=1-(1-q)^h`. Domain: integer age path within the table and positive finite `h`.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Current/target age | 65 / 67 | years |
| Sex | male | category |
| Hazard power | 1 | ratio |

## Arithmetic

From the SSA rows, `p65=16.98/17.29` and `p66=16.29/16.61`. Therefore `S(67)=p65*p66=0.963150477964002`.

## Expected

Survival probability `0.963150477964002`, absolute tolerance `1e-12`; target age 65 returns exactly `1`.

The curve's cases (revision of 2026-09-27; the male row 117 has e(117) = 0.59, e(118) = 0.54, e(119) = 0.5, so p(117) = 0.09/1.04 and p(118) = 0.04/1.00, and q(119) = 1):

| Case | Value |
|---|---:|
| Male from 117, survivalTo(1) | 0.08653846153846145 |
| Male from 117, survivalTo(2) | 0.003461538461538461 |
| Male from 117, survivalTo(3) | 0 |
| Female from 63, survivalTo(4) | 0.9580296085257168 |

The female case is the product of 1 − 0.009345794392523366, 1 − 0.010669253152279512, 1 − 0.011088709677419262 and 1 − 0.011542497376705096 (ages 63 to 66). Tolerance: exact for the male rows, 1e−15 relative for the female. The yearly death probabilities of each curve sum to 1.

## Wrong readings

- Multiplying through age 67 as well gives `0.943802822411680` (one period too many).
- Adding death probabilities gives `1-q65-q66=0.962805058308718`, missing the product term.

## Family

`longevity-survival-percentile-age`; since 2026-09-27 also `social-security-expected-present-value`, `social-security-survivor-switch-pv` and `social-security-fica-return-ratio`, whose models read the curve.

Revision 2026-09-14: the first derivation also listed `monte-carlo-success-rate` and `monte-carlo-ending-investable-histogram`. The Monte Carlo reaches mortality through the sampled death age and the q(x) identity, not through this product, so the record feeds the percentile family only.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.

Revision 2026-09-27: restated by claude (opus 5.5) for B2-P1 slice 4 from the slice's derivation (`survival-curve.md`, whose cases these are) and independent check (B2); not yet reviewed.
