## Claim

Kind: formula. `montecarlo/mortality.ts#annualMortality` derives the one-year death probability at exact integer age `x` from SSA period remaining-life expectancy by `q(x)=1-(e(x)-0.5)/(e(x+1)+0.5)`, with the table endpoint forcing death; no rounding is stated.

## Justification

Let `T` be future complete years lived and use the half-year convention `e(x)=E[T]+0.5`. Conditional on surviving the first year, `T=1+T_next`; otherwise `T=0`. Hence `e(x)-0.5=p(x)(1+e(x+1)-0.5)=p(x)(e(x+1)+0.5)`. Solving gives the claim. It assumes deaths are uniformly distributed within each age interval (the `0.5` terms), the period table applies unchanged to the cohort, and one-year transitions are represented by adjacent rounded `e(x)` rows; it does not describe individual risk.

## Inputs

| SSA 2022 male row | `e(x)` | Unit |
|---:|---:|---|
| 65 | 17.48 | remaining years |
| 66 | 16.79 | remaining years |
| 67 | 16.11 | remaining years |
| 68 | 15.43 | remaining years |

## Arithmetic

`q65=1-16.98/17.29=0.0179294389820704`. `q66=1-16.29/16.61=0.0192655027092113`. `q67=1-15.61/15.93=0.0200878844946641`. The two-year survival check is `(1-q65)(1-q66)=0.982070561017930*0.980734497290789=0.963150477964002`.

## Expected

The three `q(x)` values and the two-year survival above, absolute tolerance `1e-12`, reflecting decimal-source precision and ordinary floating arithmetic.

## Wrong readings

- Omitting both half-year corrections gives `q65=1-17.48/16.79=-0.041096` (impossible).
- Reversing the ratio gives `q65=1-17.29/16.98=-0.018257` (wrong sign).

## Family

`longevity-survival-percentile-age`, `monte-carlo-success-rate`, `monte-carlo-ending-investable-histogram`; since 2026-09-27 also `social-security-expected-present-value`, `social-security-survivor-switch-pv` and `social-security-fica-return-ratio`, whose models read q(x) through the survival curve.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.

Revision 2026-09-27 (B2-P1 slice 4): the record's DUPLICATION limit is deleted, since planner-ui's copy of the identity (`socialSecurity/expectedPv.ts#oneYearSurvival`, with its unused multiplier) and its parity test are gone and the Social Security analysis models read `montecarlo/survival.ts#survivalCurve`. Two limits are added from the slice's derivation (`survival-curve.md`) and its independent check (B3, B4): the identity rebuilds q(x) from the printed two-decimal e(x) rather than reading SSA's published q(x) (at 65, 0.0179294 against 0.017897 for men and 0.0110887 against 0.011018 for women; up to 7.3 and 20.7 percent over ages 20 to 109, 2.0 and 3.5 percent over 62 to 100, and q = 0 at men's age 8 and women's age 10), and the table is the 2022 period table of the 2025 Trustees Report while SSA's page now shows the 2023 table; both are left for the separate reviewed data change decided as D-LIFE-TABLE-2023. No value changes. Restated by claude (opus 5.5); not yet reviewed.
