## Claim

Kind: formula. `ladder/ladderMath.ts#realYieldAt` linearly interpolates annual par real yields in percent between adjacent maturities and holds the first and last yields flat outside the curve; no rounding is stated.

## Justification

Between `(m0,y0)` and `(m1,y1)`, the linear convention implies `y(m)=y0+(m-m0)(y1-y0)/(m1-m0)`. A flat endpoint returns the nearest endpoint value. Domain: an ordered nonempty maturity curve and finite maturity.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Curve points | (5, 2), (10, 3) | years, percent/year real |
| Interior maturity | 7 | years |
| Low/high endpoint probes | 2 / 15 | years |

## Arithmetic

Interior fraction `=(7-5)/(10-5)=2/5`. Yield `=2+(2/5)(3-2)=2.4%`. At 2 years the low endpoint is held at `2%`; at 15 years the high endpoint is held at `3%`.

## Expected

Yields at 7, 2, and 15 years are `2.4%`, `2%`, and `3%`, absolute tolerance `1e-12` percentage points.

## Wrong readings

- Nearest-neighbor selection at 7 years gives `2%` instead of `2.4%`.
- Linear extrapolation gives `1.4%` at 2 years and `4%` at 15 years instead of flat endpoints.

## Family

`income-floor-ladder-yield-pct`, `ladder-rung-coupon-rate-pct`, `funded-ratio-result-essential-spending-pv`, `funded-ratio-result-guaranteed-income-pv`, `funded-ratio-result-funded-ratio-pct`, `funded-ratio-result-unfunded-pv`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.
