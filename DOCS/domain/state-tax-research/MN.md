# Minnesota (MN) — state income tax for retirement planning

Tax year: 2025. (Completed example — already in `year2026.ts`.)

## Summary
- Broad individual income tax: **yes** (graduated, 5.35%–9.85%)
- Taxes Social Security benefits: **yes** (income-based subtraction; modeled as the federally taxable amount)
- Long-term capital gains: taxed as ordinary income (plus a net-investment-income tax above $1M, omitted)
- Retirement income (pension, IRA, 401k): generally taxed (no broad exclusion)

## Proposed StateTaxParams (2025)
- code: "MN"
- name: "Minnesota"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 14575, marriedFilingJointly: 29150 }
- brackets.single:
  - { lowerBound: 0, ratePct: 5.35 }
  - { lowerBound: 31690, ratePct: 6.8 }
  - { lowerBound: 104090, ratePct: 7.85 }
  - { lowerBound: 193240, ratePct: 9.85 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 5.35 }
  - { lowerBound: 46330, ratePct: 6.8 }
  - { lowerBound: 184040, ratePct: 7.85 }
  - { lowerBound: 321450, ratePct: 9.85 }
- retirement: { kind: "none" }

## Retirement-income detail
MN is one of the few states that taxes Social Security, though a sizable
income-based subtraction exempts most lower/middle-income retirees. The big-
levers model simplifies this to **taxing the federally taxable share of SS**
(`taxesSocialSecurity: true`), which overstates tax for retirees who qualify for
the subtraction — flagged below. No broad pension/IRA exclusion, so
`retirement: { kind: "none" }`.

## Simplifications / not modeled
- SS subtraction (full exemption below ~$82k MFJ, phasing out) simplified to fully taxed — overstates MN tax for many retirees. A future enhancement could add an income-tested SS exemption.
- 1% net investment income tax over $1M omitted.
- Standard deduction phase-out for high earners omitted.

## Citations
- https://www.revenue.state.mn.us/ — 2024 brackets, standard deduction, SS subtraction.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — MN.
