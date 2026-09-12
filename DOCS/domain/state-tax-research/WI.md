# Wisconsin (WI) — state income tax for retirement planning

Tax year: 2026. Updated 2026-09-12 from Form 1-ES instructions.

## Summary
- Broad individual income tax: **yes** (graduated, 3.5%–7.65%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: **preferential** — 30% of net long-term gain is excluded (only 70% taxed at ordinary rates) — see simplifications
- Retirement income (pension, IRA, 401k): generally taxed; age-67+ may subtract up to $24,000 per person of qualifying retirement income

## Proposed StateTaxParams (2026)
- code: "WI"
- name: "Wisconsin"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction maxima: { single: 13960, marriedFilingJointly: 25840 }
- wisconsinStandardDeduction (Form 1-ES page 2):
  - Single: max $13,960 through $20,119; then subtract 12% of income over $20,120 through $136,453; then $0
  - HOH: max $18,030 through $20,119; subtract 22.515% of excess over $20,120 through $58,827; then the single formula through $136,453; then $0
  - MFJ: max $25,840 through $29,039; subtract 19.778% of excess over $29,040 through $159,690; then $0
  - MFS: max $12,280 through $13,779; subtract 19.778% of excess over $13,780 through $75,869; then $0
- brackets.single / HOH: 0 / 15,110 / 51,950 / 332,720 at 3.5% / 4.4% / 5.3% / 7.65%
- brackets.marriedFilingJointly: 0 / 20,150 / 69,260 / 443,630 at the same rates
- brackets.marriedFilingSeparately: 0 / 10,080 / 34,630 / 221,820 at the same rates
- personal exemptions: $700 per eligible taxpayer/spouse/dependent + $250 per age-65 taxpayer/spouse; claimed-as-dependent → $0 personal exemption
- retirement: { kind: "capped", capPerPerson: 24000, minAge: 67 }

## Retirement-income detail
Wisconsin taxes income at graduated rates from 3.5% to 7.65%. Social Security
benefits are fully exempt. The standard deduction is income-tested per the
Form 1-ES schedules above and is applied from `wisconsinStandardDeduction` in
the year pack.

**Capital gains**: Wisconsin allows a **30% exclusion** of net long-term capital
gain (60% for farm assets). The pack still sets `capitalGainsAsOrdinary: true`
and does not apply that preference — registered separately.

**Retirement income**: Taxpayers age 67+ by Dec 31 may subtract up to **$24,000
per person** of qualifying retirement income, with per-recipient attribution and
credit-forfeiture limbs that the coarse pack cap does not yet express.

## Simplifications / not modeled
- **30% long-term capital-gains exclusion** not modeled (`capitalGainsAsOrdinary:
  true`) — overstates WI tax on long-term gains.
- The $24,000 retirement subtraction’s per-recipient attribution, credit
  forfeiture, and Line 17 age-65 limb remain approximated by the coarse
  `capPerPerson` / `minAge` pack fields.
- Nonresident / part-year Form 1NPR proration is out of resident scope.

## Citations
- https://www.revenue.wi.gov/TaxForms2026/2026-Form1-ES-Inst.pdf — TY2026 Form 1-ES instructions page 2 (SD phase-down) and rate schedules.
- https://www.revenue.wi.gov/Pages/FAQS/pcs-taxrates.aspx — individual rate formulas.
- https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf — 30% long-term capital-gain exclusion; $24,000 age-67 retirement income subtraction.

## Wisconsin applies the 2026 income-tested deduction, exemptions and status schedules (verified 2026-09-12)

TY2026 Form 1-ES supplies the 3.5%, 4.4%, 5.3% and 7.65% schedules, with separate published MFS boundaries rather than rounded half-joint values. Standard deductions phase down with Wisconsin income: maximum $13,960 single, $18,030 HOH, $25,840 joint and $12,280 MFS. Eligible personal/dependent exemptions add $700 each and eligible age-65 additions add $250; dependency disallows the personal exemption. Part-year/nonresident calculations need the instructed income-ratio proration. The 2026 estimated-tax source is explicit; this record does not claim unpublished final 2026 Form 1 instructions.

Registered as `wi-2026-rates-standard-deduction-exemptions`. Authority: [Wisconsin 2026 Form 1-ES, pages 2–3](https://www.revenue.wi.gov/TaxForms2026/2026-Form1-ES-Inst.pdf).
