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

## A traditional IRA converted in full to a Roth IRA is not taxed (2026-10-06)

Record: `pa-40-roth-ira-conversion-not-taxable`. Classification: `settled`.

The 2025 PA-40 instructions: no PA tax on the difference between the amount distributed from a traditional IRA and the previous contributions when the entire withdrawal goes to a Roth IRA, trustee to trustee or within 60 days, with any federal tax withheld also put into the new IRA. There is no age condition, so the engine subtracts an IRA conversion at any age; until 2026-10-06 it taxed the conversion of an owner under 60, $1,228 on $40,000. An in-plan Roth rollover is not addressed by the instructions and 61 Pa. Code 101.6(c)(8)(iii)(A)(II) exempts a transfer only when it is not included in federal income, so the engine keeps it under the age-60 rule; whether Pennsylvania taxes it is not determined.

Authority: [2025 PA-40 instructions](https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/formsandpublications/formsforindividuals/pit/documents/2025/2025_pa-40in.pdf), Roth IRA Rollover.

## Part-year residents (2026-10-08)

Method (c), 2025 PA-40 instructions: the income received while a resident, at the flat rate, with no deduction or exemption to prorate; retirement income is not taxable (pa-40-roth-ira-conversion-not-taxable). The 2026 figures carry it as `partYear: { method: 'residentPeriod', standardDeduction: 'full', exemptions: 'full', ratioBasis: 'federalAgi', exclusionCap: 'full' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Pennsylvania and six in Texas, owes $1,535.00 for the Pennsylvania months, the same as before. With a $40,000 Roth conversion on top, the slice is $1,535.00 when the conversion falls in the months resident and $1,535.00 when it falls in Texas's, where the months share of the year gave $2,149.00 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
