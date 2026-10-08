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
- Part-year residents: Form 1NPR (2025 instructions) looks the deduction up in its
  Standard Deduction Table by the year's federal income (line 31) and prorates the tax by Wisconsin income over
  federal income (line 32). From 2026-10-08 the split-year slice is that method, the
  full-year tax with the year's household facts times line 32 (Part-year residents,
  below); from 2026-10-07 it was the months share with the deduction phased on the
  year's income, and before that it phased it on the slice's own income. A single
  filer of 50 with $100,000 of ordinary income, resident six months: $1,798.39, then
  and now $2,232.31; with the $700 exemption supplied, $2,213.76. Nonresident
  returns are out of scope.

## Citations
- https://www.revenue.wi.gov/TaxForms2026/2026-Form1-ES-Inst.pdf — TY2026 Form 1-ES instructions page 2 (SD phase-down) and rate schedules.
- https://www.revenue.wi.gov/Pages/FAQS/pcs-taxrates.aspx — individual rate formulas.
- https://www.revenue.wi.gov/TaxForms2025/2025-ScheduleSB-Inst.pdf — 30% long-term capital-gain exclusion; $24,000 age-67 retirement income subtraction.

## Wisconsin applies the 2026 income-tested deduction, exemptions and status schedules (verified 2026-09-12)

TY2026 Form 1-ES supplies the 3.5%, 4.4%, 5.3% and 7.65% schedules, with separate published MFS boundaries rather than rounded half-joint values. Standard deductions phase down with Wisconsin income: maximum $13,960 single, $18,030 HOH, $25,840 joint and $12,280 MFS. Eligible personal/dependent exemptions add $700 each and eligible age-65 additions add $250; dependency disallows the personal exemption. A part-year resident's Form 1NPR looks the deduction up in its Standard Deduction Table by the year's federal income (line 31) and prorates the tax by the ratio of Wisconsin income to federal income (line 32). From 2026-10-08 a year split between states takes that method: the tax on the whole year's income as a resident, the sliding deduction and the exemptions on the year's facts, times line 32, line 30 Wisconsin income over line 31 federal income, with the $24,000 subtraction at 67 in the Wisconsin column reduced by the same share. Until 2026-10-07 the slice phased the deduction on its own income, and until 2026-10-08 it took the months share and dropped the exemptions. The 2026 estimated-tax source is explicit; this record does not claim unpublished final 2026 Form 1 instructions.

Registered as `wi-2026-rates-standard-deduction-exemptions`. Authority: [Wisconsin 2026 Form 1-ES, pages 2–3](https://www.revenue.wi.gov/TaxForms2026/2026-Form1-ES-Inst.pdf).

## Part-year residents (2026-10-08)

Method (b), 1NPR 2025 instructions: the sliding deduction on the year's federal income; line 32 divides line 30, the Wisconsin column, by line 31, federal income; Schedule SB reduces the $24,000 subtraction at 67 by the Wisconsin share of the income (wi-2026-rates-standard-deduction-exemptions). The 2026 figures carry it as `partYear: { method: 'incomePercentage', ratioBasis: 'stateOverFederalAgi', exclusionCap: 'incomeRatio' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months. Taking the subtraction's share on federal AGI items leaves out Wisconsin's modifications, which move the form's share either way, so the figure errs in either direction.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Wisconsin and six in Texas, owes $2,232.31 for the Wisconsin months, the same as before. With a $40,000 Roth conversion on top, the slice is $4,382.01 when the conversion falls in the months resident and $2,434.45 when it falls in Texas's, where the months share of the year gave $3,408.23 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
