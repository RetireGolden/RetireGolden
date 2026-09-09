# Maine TY2026 pension deduction cap correction

The planning engine previously held Maine's flat per-person pension exclusion at **$48,216**. The July 2026 MRS Form 1040ES-ME instructions publish **$49,824** as the 2026 maximum before the statutory Social Security and Railroad Retirement reduction and the federal-AGI phaseout in §5122(2)(M-3). This correction updates only that published ceiling in the 2026 state pack. It does not certify plan qualification under M-2, military separation under M-2(1)(b), the gross-benefit offset, the M-3 phaseout, personal exemption, or whole Form 1040ME accuracy.

Authority: [MRS 2026 Form 1040ES-ME Instructions, revised July 2026](https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_1040es_fillable.pdf) ("Note that the maximum pension income deduction is increased to $49,824 for tax year 2026"); [36 M.R.S. §5122(2)(M-2) and (M-3)](https://legislature.maine.gov/statutes/36/title36sec5122.html). The registry record `me-mrs-36-5122-2-m2-m3-2026-pension-deduction` carries the precise primary quotations and discloses what the flat cap still omits.

## Observed impact (original cap-correction vectors)

The direct fixture uses a single Maine resident, age 60, zero capital gains, **$80,000** ordinary income (which already includes **$60,000** of private retirement income standing in for a qualifying nonmilitary pension), and the 2026 Maine basic standard deduction **$15,700**. Maine AGI stays below the §5124-C(2) phase-out start. Both Social Security variants share the same before and after runtime totals because the gross-benefit offset remains unimplemented.

| Social Security benefits | Before taxable / tax | After taxable / tax | Independent worksheet taxable income |
|---|---:|---:|---:|
| $0 | $16,084 / $932.872 | $14,476 / $839.608 | $80,000 − $49,824 − $15,700 = **$14,476** |
| $20,000 | $16,084 / $932.872 | $14,476 / $839.608 | $80,000 − ($49,824 − $20,000) − $15,700 = **$34,476** (independent worksheet after gross-benefit offset); runtime still **$14,476** |

The stale cap produced $80,000 − $48,216 − $15,700 = **$16,084** taxable income in both rows. Modeled tax applies Maine's 5.8% first bracket only at these incomes.

[Before observations](maine-pension-cap-correction-2026-09-08/before.json) and [after observations](maine-pension-cap-correction-2026-09-08/after.json) contain the literal inputs, runtime taxable income and tax, observed heads, and per-file source hashes. Before head `45246050c897bd3cb7d0f1513e6af3544b94c68b`; after head `903798d33f96d52e1d45aa3903feeda408d1702e` (rebased onto `6b04f2f6`). These receipts are evidence of engine behavior for the original cap-correction vectors only, not the legal oracle: the last column supplies the independent statutory worksheet for the corrected maximum. Where the with-Social-Security row diverges, the gap is the disclosed gross-benefit offset omission, not further cap error.

The bundled example-case comparison produced no deltas. The catalog does not exercise this bounded Maine pension fixture, so that comparison does not substitute for the direct observations above.

## Additional fixture vectors (PR 688 R1; not in raw receipts)

PR 688 R1 extends the same `me-mrs-36-5122-2-m2-m3-2026-pension-deduction` compact vector fixture with independent-worksheet rows that are **not** represented in the immutable before/after observation JSON above. A separate R1 observation produced $34,300 for the below-cap case and $58,600 for the MFJ case; these rows remain outside the immutable before/after JSON receipts. The table distinguishes the independent worksheet from the modeled result.

| Vector | Independent worksheet taxable income | What it discriminates |
|---|---:|---|
| Below-cap lesser-of benefits (single, $80,000 ordinary including $30,000 qualifying pension, no SS) | $80,000 − $30,000 − $15,700 = **$34,300** | Lesser-of benefits in federal AGI versus an unconditional $49,824 subtraction (**$14,476**) |
| MFJ one represented eligible recipient (two `agesAlive`, $150,000 ordinary including $60,000 qualifying pension, no SS) | $150,000 − $49,824 − $31,400 = **$68,776** statutory one-recipient counterfactual | Per-recipient attribution: the current `agesAlive.length` proxy is expected to subtract the full $60,000 pension (**$58,600** modeled taxable income) |

M-3 numerator is zero for the original single-filer rows: federal AGI is $80,000 and $97,000, each below the unindexed $125,000 single applicable amount defined in the quoted authority; no final numeric 2026 indexed M-3 applicable amount is asserted in this correction.
