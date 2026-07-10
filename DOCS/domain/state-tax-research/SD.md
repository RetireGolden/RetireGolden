# South Dakota (SD) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **no** — South Dakota has no individual income tax.
- Taxes Social Security benefits: no (no income tax)
- Long-term capital gains: not taxed (no income tax)
- Retirement income (pension, IRA, 401k): not taxed (no income tax)

## Proposed StateTaxParams (2025)
- code: "SD"
- name: "South Dakota"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## Retirement-income detail
South Dakota levies no individual income tax of any kind, so wages, pensions,
IRA/401(k) distributions, Social Security, and capital gains are all untaxed at
the state level. No brackets or deductions apply.

## Simplifications / not modeled
- State revenue comes from sales/use and property taxes (not modeled here — this doc covers only individual income tax).

## Citations
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — SD listed among states with no individual income tax.
