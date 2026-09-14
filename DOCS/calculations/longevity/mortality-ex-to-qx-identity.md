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

`longevity-survival-percentile-age`, `monte-carlo-success-rate`, `monte-carlo-ending-investable-histogram`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
