## Claim

Kind: data. The embedded constant `EMBEDDED_REAL_YIELD_CURVE` carries the five real yields shown by the signatures-and-comments extract for the 2026-06-30 vintage: `[1.85,2.05,2.25,2.55,2.70]` percent/year at 5, 7, 10, 20, and 30 years.

## Justification

Primary source: U.S. Treasury Daily Treasury Par Real Yield Curve Rates, row 2026-06-30, `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?field_tdr_date_value=2026&type=daily_treasury_real_yield_curve`, retrieval recorded 2026-09-14. Official row: `1.93/2.06/2.20/2.54/2.73`. Embedded file: `1.85/2.05/2.25/2.55/2.70`, which does not reconcile. Nearest-5bp transformation yields `1.95/2.05/2.20/2.55/2.75`; no-rounding preserves the official row. Rights note: US-government factual data is attributed and linked; this worksheet does not infer blanket public-domain status or copy expressive material.

## Inputs

| Maturity | 5y | 7y | 10y | 20y | 30y |
|---|---:|---:|---:|---:|---:|
| Official percent/year | 1.93 | 2.06 | 2.20 | 2.54 | 2.73 |
| Embedded percent/year | 1.85 | 2.05 | 2.25 | 2.55 | 2.70 |

## Arithmetic

Nearest 0.05 percentage point: `1.93→1.95`, `2.06→2.05`, `2.20→2.20`, `2.54→2.55`, `2.73→2.75`. Embedded-minus-official errors are `-0.08,-0.01,+0.05,+0.01,-0.03` percentage point.

## Deviation from the official row

| Maturity | Stored value | Official 2026-06-30 value | Official rounded to nearest 5bp | Stored minus official |
|---|---:|---:|---:|---:|
| 5y | 1.85 | 1.93 | 1.95 | -8bp |
| 7y | 2.05 | 2.06 | 2.05 | -1bp |
| 10y | 2.25 | 2.20 | 2.20 | +5bp |
| 20y | 2.55 | 2.54 | 2.55 | +1bp |
| 30y | 2.70 | 2.73 | 2.75 | -3bp |

The stored row is not the official row. A data-correction change is owed to the engine; that correction must state the product decision between embedding the exact official row and embedding its nearest-5bp rounding.

## Expected

Embedded dataset row `[1.85,2.05,2.25,2.55,2.70]`, with exact tolerance.

## Wrong readings

- Treating the stored row `[1.85,2.05,2.25,2.55,2.70]` as the official 2026-06-30 Treasury row.
- Treating the official row's nearest-5bp rounding `[1.95,2.05,2.20,2.55,2.75]` as the stored row.

## Family

`income-floor-ladder-yield-pct`, `ladder-rung-cost`, `ladder-rung-coupon-rate-pct`, `ladder-build-total-cost`, `funded-ratio-result-essential-spending-pv`, `funded-ratio-result-guaranteed-income-pv`, `funded-ratio-result-funded-ratio-pct`, `funded-ratio-result-unfunded-pv`.

## Revision

2026-09-14: The first derivation refused to choose between the official row and nearest-5bp rounding, which left the evidence fixture pinning a value the worksheet called wrong. This card now states the embedded dataset fact and its deviation from the official row.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory.
