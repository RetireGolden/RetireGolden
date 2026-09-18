## Claim

Kind: model. `montecarlo/marketModels.ts#createCapeConditionedModel` starts from the mean-preserving lognormal shock and shifts its mean downward linearly by `sensitivity*(CAPE-20)` percentage points when starting CAPE exceeds 20.

## Justification

The comment's “linear taper” implies a valuation-conditioned deviation from the plan assumption. It is a modeling hypothesis, not proof CAPE causes the stated future return change.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Starting CAPE | 25 | ratio |
| Sensitivity | 0.15 | percentage points per CAPE point |
| Volatility | 0 | percentage points |

## Arithmetic

Base lognormal shock is `0`. CAPE adjustment `=0.15(25-20)=0.75`; shifted shock `=0-0.75=-0.75` points.

## Expected

Return shock `-0.75` percentage points, absolute tolerance `1e-12`.

## Wrong readings

- Raising returns at high CAPE gives `+0.75`.
- Multiplying 25 by 0.15 without the 20 reference gives `-3.75`.

## Family

`monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`, `monte-carlo-ending-investable-histogram`, `monte-carlo-ending-after-tax-estate-percentiles`, `monte-carlo-depletion-probability-by-year`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
