## Claim

Kind: data. The embedded constant `EMBEDDED_REAL_YIELD_CURVE` (`params/data/realYieldCurve2026.ts#REAL_YIELD_CURVE_2026`) carries the official U.S. Treasury par real yields for 2026-06-30, exactly as published: `[1.93,2.06,2.20,2.54,2.73]` percent/year at 5, 7, 10, 20, and 30 years.

## Justification

Primary source: U.S. Treasury, Daily Treasury Par Real Yield Curve Rates. The page `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_real_yield_curve&field_tdr_date_value_month=202606`, retrieved 2026-09-27, heads its table "Daily Treasury Par Real Yield Curve Rates" with the columns "Date", "5 YR", "7 YR", "10 YR", "20 YR" and "30 YR", and its row for 2026-06-30 reads, in the page text, "06/30/2026 1.93 2.06 2.20 2.54 2.73". The same page's CSV download for 2026 (`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_real_yield_curve&field_tdr_date_value=2026&page&_format=csv`, same day) carries the header `Date,"5 YR","7 YR","10 YR","20 YR","30 YR"` and the line `06/30/2026,1.93,2.06,2.20,2.54,2.73`. The first retrieval, recorded 2026-09-14, read the same row.

Decision D-TREASURY (2026-09-25) chose the exact official values over their nearest-5bp rounding: the data card cites Treasury, and rounding to 5 basis points would be a transformation no source asks for. Rights note: US-government factual data is attributed and linked; this worksheet does not infer blanket public-domain status or copy expressive material.

## Inputs

| Maturity | 5y | 7y | 10y | 20y | 30y |
|---|---:|---:|---:|---:|---:|
| Official percent/year, 06/30/2026 | 1.93 | 2.06 | 2.20 | 2.54 | 2.73 |

## Arithmetic

None. The embedded row is the official row, digit for digit; no rounding, scaling or interpolation is applied before storage.

## Deviation from the official row

| Maturity | Stored value | Official 2026-06-30 value | Stored minus official | Stored before 2026-09-27 |
|---|---:|---:|---:|---:|
| 5y | 1.93 | 1.93 | 0bp | 1.85 |
| 7y | 2.06 | 2.06 | 0bp | 2.05 |
| 10y | 2.20 | 2.20 | 0bp | 2.25 |
| 20y | 2.54 | 2.54 | 0bp | 2.55 |
| 30y | 2.73 | 2.73 | 0bp | 2.70 |

## Expected

Embedded dataset row `[1.93,2.06,2.20,2.54,2.73]`, with exact tolerance.

## Wrong readings

- Keeping the earlier stored row `[1.85,2.05,2.25,2.55,2.70]`, which is neither the official row nor its nearest-5bp rounding (it deviates by `-8,-1,+5,+1,-3` basis points).
- Rounding the official row to the nearest 5 basis points, `[1.95,2.05,2.20,2.55,2.75]` (`1.93→1.95`, `2.06→2.05`, `2.54→2.55`, `2.73→2.75`), which decision D-TREASURY declined.
- Reading another date's row from the same table, for example 06/29/2026 (`1.90,2.02,2.16,2.49,2.68`) or 07/01/2026 (`1.98,2.11,2.25,2.58,2.78`).

## Family

`income-floor-ladder-yield-pct`, `ladder-rung-cost`, `ladder-rung-coupon-rate-pct`, `ladder-build-total-cost`, `funded-ratio-result-essential-spending-pv`, `funded-ratio-result-guaranteed-income-pv`, `funded-ratio-result-funded-ratio-pct`, `funded-ratio-result-unfunded-pv`.

## Revision

2026-09-14: The first derivation refused to choose between the official row and nearest-5bp rounding, which left the evidence fixture pinning a value the worksheet called wrong. This card then stated the embedded dataset fact and its deviation from the official row.

2026-09-27 (decision D-TREASURY): the engine now embeds the official row exactly, so the claim, the Expected row and the deviation table state the official values, and the former stored row moved to the wrong readings. The official row was read again from Treasury's page text and CSV on 2026-09-27 and is quoted above.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-14, by independent recomputation without executing the engine; see REVIEW-2026-09-14.md in this directory. That review covered the 2026-09-14 card.

Restated 2026-09-27 by claude, the implementer of decision D-TREASURY: the claim is now the official row, read again from Treasury on 2026-09-27. The restatement is unreviewed until a reviewer who is not its author reads the source again, so the record carries reviewedBy 'unreviewed'.
