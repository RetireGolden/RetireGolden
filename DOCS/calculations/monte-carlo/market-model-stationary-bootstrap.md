## Claim

Kind: model. `montecarlo/marketModels.ts#createStationaryBootstrapModel` samples historical years in geometrically distributed contiguous blocks with configured mean block length, wrapping at the dataset end.

## Justification

For a geometric restart probability `p`, expected block length is `1/p`; choosing `p=1/L` preserves observations while randomizing dependence lengths. It does not establish that historical dependence recurs.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Mean block length `L` | 5 | years |
| Continuation draw | 0.50 | probability |

## Arithmetic

Restart probability `p=1/5=0.20`; `0.50>=0.20`, so the next observation continues the current historical block.

## Expected

Continuation `true`, exact Boolean.

## Wrong readings

- Using `p=L` produces probability 5, restarting every year.
- Treating mean length 5 as fixed always makes every block exactly five years.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
