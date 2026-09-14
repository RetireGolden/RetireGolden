## Claim

Kind: formula. `montecarlo/survival.ts#survivalPercentileAge` returns the oldest integer age whose conditional survival probability from the current age is at least `pct/100`, bounded by the current age and table endpoint.

## Justification

Survival is nonincreasing because every annual factor lies in `[0,1]`; consequently the qualifying ages form an initial interval and its last member is the stated percentile age. Domain: percentage threshold interpreted on 0–100 scale and valid age/sex/hazard inputs.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Current age | 65 | years |
| Sex | male | category |
| Threshold | 97 | percent |
| Hazard | 1 | ratio |

## Arithmetic

`S(65)=1`. `S(66)=0.982070561017930 >= 0.97`. `S(67)=0.963150477964002 < 0.97`. Therefore the oldest qualifying age is 66.

## Expected

Percentile age `66`, exact integer.

## Wrong readings

- Returning the first failing age gives `67`.
- Interpreting 97 as a probability rather than 97% finds no later age and can incorrectly return only the current age `65`.

## Family

`longevity-survival-percentile-age`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.
