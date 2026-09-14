## Claim

Kind: data. `params/data/realYieldCurve2026.ts#REAL_YIELD_CURVE_2026` is an offline 2026-06-30 Treasury daily par real-yield curve in percent/year at 5, 7, 10, 20, and 30 years, consumed with linear interpolation and flat endpoints; the calculation card must choose either unrounded official values or nearest-5-basis-point values.

## Justification

Primary source: U.S. Treasury Daily Treasury Par Real Yield Curve Rates, row 2026-06-30, `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=2026&type=daily_treasury_real_yield_curve`, retrieval recorded 2026-09-14. Official row: `1.93/2.06/2.20/2.54/2.73`. Embedded file: `1.85/2.05/2.25/2.55/2.70`, which does not reconcile. Nearest-5bp transformation yields `1.95/2.05/2.20/2.55/2.75`; no-rounding preserves the official row. Rights note: US-government factual data is attributed and linked; this worksheet does not infer blanket public-domain status or copy expressive material.

## Inputs

| Maturity | 5y | 7y | 10y | 20y | 30y |
|---|---:|---:|---:|---:|---:|
| Official percent/year | 1.93 | 2.06 | 2.20 | 2.54 | 2.73 |
| Embedded percent/year | 1.85 | 2.05 | 2.25 | 2.55 | 2.70 |

## Arithmetic

Nearest 0.05 percentage point: `1.93→1.95`, `2.06→2.05`, `2.20→2.20`, `2.54→2.55`, `2.73→2.75`. Embedded-minus-official errors are `-0.08,-0.01,+0.05,+0.01,-0.03` percentage point.

## Expected

Card decision required: either exact official `[1.93,2.06,2.20,2.54,2.73]` with exact two-decimal equality, or declared nearest-5bp `[1.95,2.05,2.20,2.55,2.75]` with exact two-decimal equality. This worksheet does not choose between them.

## Wrong readings

- Keeping the embedded row returns `[1.85,2.05,2.25,2.55,2.70]`.
- Rounding to the nearest 0.5 percentage point gives `[2.0,2.0,2.0,2.5,2.5]`, confusing 5bp with 50bp.

## Family

`income-floor-ladder-yield-pct`, `ladder-rung-cost`, `ladder-rung-coupon-rate-pct`, `ladder-build-total-cost`, `funded-ratio-result-essential-spending-pv`, `funded-ratio-result-guaranteed-income-pv`, `funded-ratio-result-funded-ratio-pct`, `funded-ratio-result-unfunded-pv`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
