# Pennsylvania (PA) — state income tax for retirement planning

Tax year: 2025. (Completed example — already in `year2026.ts`.)

## Summary
- Broad individual income tax: **yes** (flat 3.07%)
- Taxes Social Security benefits: no
- Long-term capital gains: taxed as ordinary income (flat 3.07%); PA uses current-year gain/loss netting
  and does not conform to federal prior-year capital-loss carryforward offsets
- Retirement income (pension, IRA, 401k): exempt for retirees (age 59½+)

## Proposed StateTaxParams (2025)
- code: "PA"
- name: "Pennsylvania"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- capitalLossCarryforwardConformity: "currentYearOnly"
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: [ { lowerBound: 0, ratePct: 3.07 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 3.07 } ]
- retirement: { kind: "full", minAge: 60 }

## Retirement-income detail
PA taxes wages and investment income at a flat 3.07% with **no** standard
deduction. It fully exempts Social Security and "eligible" retirement income
(employer pensions and IRA/401(k) distributions taken after reaching the plan's
retirement age / 59½). Modeled as `kind: "full"` with `minAge: 60` (whole-year
approximation of 59½).

For capital gains, RetireGolden taxes current-year net gains at the PA rate even
when a federal prior-year capital-loss carryforward has reduced the federal
capital-gain line to zero. This is encoded as
`capitalLossCarryforwardConformity: "currentYearOnly"`.

## Simplifications / not modeled
- PA's "eligibility" turns on retirement/separation, not purely age; approximated by age 60.
- Local earned-income taxes (≈1–3.9%) are modeled only through the optional
  plan-level flat local income-tax percentage, not a PA municipality pack.
- Personal/dependent exemptions and the Tax Forgiveness credit not modeled.

## Citations
- https://www.revenue.pa.gov/ — flat 3.07% rate; retirement income exempt.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — PA flat 3.07%.
