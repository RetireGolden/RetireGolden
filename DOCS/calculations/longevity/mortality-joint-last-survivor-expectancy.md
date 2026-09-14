## Claim

Kind: formula. `montecarlo/mortality.ts#jointLastSurvivorExpectancy` computes remaining years until both independent lives are dead as `0.5 + sum(t>=1)[1-(1-Sa(t))(1-Sb(t))]`, without rounding.

## Justification

At future integer time `t`, at least one life remains with probability `1-P(A dead)P(B dead)` under independence. Summing those survival indicators gives curtate expectation; adding one half applies the within-year death convention. Population independence is an assumption and can understate shared household hazards.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Both lives | male, age 118 | age/sex |
| SSA male `e(118)`, `e(119)` | 0.54, 0.50 | remaining years |

## Arithmetic

One-year survival for either life is `(0.54-0.5)/(0.50+0.5)=0.04`. Both are dead after one year with probability `0.96^2=0.9216`, so at least one survives with probability `0.0784`. The endpoint forces later survival to zero. Expectancy `=0.5+0.0784=0.5784` years.

## Expected

Joint last-survivor expectancy `0.5784` years, absolute tolerance `1e-12`.

## Wrong readings

- Using single-life survival gives `0.5+0.04=0.54` years.
- Adding the two survival probabilities without subtracting their overlap gives `0.5+0.08=0.58` years.

## Family

none yet — the census does not expose joint remaining-life expectancy directly.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
