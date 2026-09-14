## Claim

Kind: formula. `montecarlo/survival.ts#jointSurvivalPercentileAge` returns the oldest primary-clock integer age at which at least one of two independent lives survives with probability at least `pct/100`, using `1-(1-Sa)(1-Sb)`.

## Justification

Under independence, both are dead with probability `(1-Sa)(1-Sb)`; its complement is last-survivor survival. The primary age clock advances the partner by the same elapsed years. Independence is a model assumption, not an empirical household claim.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Both people | male, age 65 | age/sex |
| Threshold | 99 | percent |
| Hazard powers | 1, 1 | ratio |

## Arithmetic

Single-life survival at primary ages 69, 70, 71 is `0.923392932`, `0.902507417`, `0.879847618`. Joint values are respectively `1-(1-S)^2 = 0.994131357`, `0.990495196`, `0.985563405`. Age 70 qualifies and 71 fails.

## Expected

Joint percentile age `70`, exact integer (intermediate display values may use absolute tolerance `1e-9`).

## Wrong readings

- Multiplying survivals computes both-alive probability and returns an earlier boundary.
- Using one person's 99th-percentile result returns age `65`, violating the last-survivor construction here.

## Family

`longevity-survival-percentile-age`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.
