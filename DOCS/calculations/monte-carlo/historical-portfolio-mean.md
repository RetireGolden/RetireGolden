## Claim

Kind: formula. `montecarlo/historicalReturns.ts#meanPortfolioReturnPct` returns the arithmetic mean of the 96 annual blended nominal returns for a given equity percentage, used to center bootstrap shocks.

## Justification

Linearity of sums gives mean blend `w*mean(stocks)+(1-w)*mean(bonds)`. Arithmetic rather than geometric mean is required to make the average additive shock zero.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Row count | 96 | years |
| Stock/bond column sums | 1118.9 / 466.6 | percentage points |
| Equity weight | 60 | percent |

## Arithmetic

Blended sum `=0.6(1118.9)+0.4(466.6)=671.34+186.64=857.98`; mean `=857.98/96=8.93729166666667%`.

## Expected

`8.93729166666667%`, absolute tolerance `1e-12` percentage points.

## Wrong readings

- Dividing by 95 gives `9.03157894737%`.
- Averaging the separate means without weights gives `(11.6552083+4.8604167)/2=8.2578125%`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
