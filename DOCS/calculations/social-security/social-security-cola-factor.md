## Claim

Kind: model. `projection/internal/annualSocialSecurity.ts#annualSocialSecurity`, and through it `socialSecurity/householdYear.ts#socialSecurityYear`, receives an `ssColaFactor` that compounds from the projection start, with factor 1 in the first year, using either the plan's general inflation rate or its fixed `ssCola` rate. The implied fixed-rate formula for year offset `n` is `(1 + rate)^n`.

## Justification

“Compounds from the projection start” and “factor 1 in the first year” imply exponent zero in the start year, then one additional factor per elapsed projection year. The fixed example uses `year2026.socialSecurity.colaPct = 2.8` as the stated fixed `ssCola` rate.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Projection start year | 2026 | year |
| Fixed COLA rate | 2.8 | percent/year |
| Evaluated years | 2026, 2027, 2028 | years |

The rate is `params/data/year2026.ts#year2026.socialSecurity.colaPct = 2.8`.

## Arithmetic

2026: `1.028^0 = 1`.

2027: `1.028^1 = 1.028`.

2028: `1.028^2 = 1.056784`.

For a `$2,000` start-year monthly amount, the corresponding values are `$2,000`, `$2,056`, and `$2,113.568` before any separate rounding.

## Expected

Exact derived factors: `1`, `1.028`, `1.056784`. Fixture tolerance: `1e-12`, because these are two short multiplications of an exactly specified decimal rate and no output rounding is stated here.

## Wrong readings

- Applying COLA once in the first projection year produces factors `1.028`, `1.056784`, `1.086373952`.
- Simple addition produces third-year factor `1.056`, losing compounding.
- Combining plan inflation and fixed `ssCola` applies two rates when the comment describes alternatives.

## Family

outputs: none.

feeds: `social-security-benefit-annual`, `social-security-break-even`, `social-security-expected-present-value`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-four.md in this directory.

Revision 2026-09-27 (B2-P1 slice 4, owner decision R6): the factor and the haircut are two functions, `socialSecurity/colaFactor.ts#socialSecurityColaFactor` and `#socialSecurityHaircutFactor`. `projection/simulate.ts#simulatePlan` calls them with its own inflation-factor function, so a Monte Carlo path's inflation series still drives its factor and no path moves (the independent check's correction 6); the break-even chart and the benefits-only expected value call the same two on the plan's deterministic inflation, so their dollars are the plan's. The worksheet's cases are unchanged. Restated by claude (opus 5.5); not yet reviewed.
