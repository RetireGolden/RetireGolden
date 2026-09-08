# Ohio TY2026 nonbusiness schedule correction

The planning engine previously omitted the $332 cumulative tax due when Ohio's nonbusiness balance exceeds $26,050. The corrected schedule is zero at or below $26,050 and $332 plus 2.75% of the excess above that threshold. This is gross nonbusiness tax before credits; it does not certify an Ohio return, exemptions, business income, or municipal taxes.

Authority: [Ohio Rev. Code §5747.02(A)(3)(c)](https://codes.ohio.gov/ohio-revised-code/section-5747.02), with the operative balance definition in (A)(3). The registry's `oh-rev-code-5747-02-a-3-c-2026-nonbusiness-rate-schedule` carries the precise primary quotations, the enacted LSC explanation of the TY2026 indexing suspension, and the conflicting official 2026 estimated-payment worksheet. The fixed-dollar record ends after TY2026; later reuse of the pack remains a planning convention.

## Observed impact

The synthetic fixtures use no Social Security, gains, retirement exclusions, exemptions, or credits, so ordinary income equals the tested nonbusiness balance. Both supported filing statuses have the same observed results:

| Balance | Before | After | Independent schedule calculation |
|---|---:|---:|---|
| $26,050 | $0 | $0 | Balance does not exceed threshold |
| $26,051 | $0.0275 | $332.0275 | $332 + 2.75% × $1 |
| $50,000 | $658.625 | $990.625 | $332 + 2.75% × $23,950 |
| $100,000 | $2,033.625 | $2,365.625 | $332 + 2.75% × $73,950 |

[Before observations](ohio-base-tax-correction-2026-09-08/before.json) and [after observations](ohio-base-tax-correction-2026-09-08/after.json) include direct, annual, and split-year results plus the observed heads and runtime-file hashes. These outputs are evidence of behavior, not the correctness oracle: the last column supplies the independent statutory worksheet.

Under the existing linear residency convention, six months in Ohio and six in Texas at $50,000 annual income now produce $495.3125, half the full-year amount; this is a model regression, not a claim about Ohio part-year filing law. The separate unimplemented retirement-credit approximation remains disclosed, with $990.625 produced before credit versus $790.625 after the illustrative $200 credit.

The bundled example-case comparison produced no deltas. Those examples contain no Ohio-specific plan, so this comparison does not substitute for the direct Ohio boundary and residency fixtures.
