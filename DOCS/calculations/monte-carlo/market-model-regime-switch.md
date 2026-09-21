## Claim

Kind: model. `montecarlo/marketModels.ts#createRegimeSwitchModel` applies persistent bull/bear states with annual switch probability, state-specific mean deviations and volatilities, while inflation remains centered on its configured mean.

## Justification

A two-state Markov chain retains its state with probability `1-p` and switches with `p`; symmetric `+a/-a` state deviations are near zero only under equal long-run state mass. This is a scenario model, not evidence markets have two regimes.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Bull/bear deviation | +4 / -4 | percentage points |
| Volatility | 0 / 0 | percentage points |
| Current state | bull | category |
| Switch draw / probability | 0.9 / 0.05 | probability |

## Arithmetic

`0.9>=0.05`, so state remains bull; with zero volatility shock is `+4` points.

## Expected

Bull state and return shock `+4`, exact for the degenerate volatility case.

## Wrong readings

- Interpreting 0.05 as 5 percentage points and comparing with 0.9 incorrectly switches.
- Treating `+4` as the whole return rather than a deviation discards the plan expected return.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
