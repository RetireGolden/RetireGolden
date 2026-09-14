## Claim

Kind: formula. `montecarlo/survival.ts#survivalProbabilityTo` returns 1 when target age is not later than current age and otherwise multiplies annual survival probabilities `(1-q(x))^h` over integer ages, where `h` is the proportional-hazards power; no rounding is stated.

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

## Wrong readings

- Multiplying through age 67 as well gives `0.943802822411680` (one period too many).
- Adding death probabilities gives `1-q65-q66=0.962805058308718`, missing the product term.

## Family

`longevity-survival-percentile-age`.

Revision 2026-09-14: the first derivation also listed `monte-carlo-success-rate` and `monte-carlo-ending-investable-histogram`. The Monte Carlo reaches mortality through the sampled death age and the q(x) identity, not through this product, so the record feeds the percentile family only.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.
