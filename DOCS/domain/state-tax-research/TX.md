# Texas (TX) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **no** — Texas has no individual income tax (constitutionally prohibited since the 2019 amendment).
- Taxes Social Security benefits: no (no income tax)
- Long-term capital gains: not taxed (no income tax)
- Retirement income (pension, IRA, 401k): not taxed (no income tax)

## Proposed StateTaxParams (2025)
- code: "TX"
- name: "Texas"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## Retirement-income detail
Texas levies no individual income tax; a 2019 constitutional amendment
prohibits one. Wages, pensions, IRA/401(k) distributions, Social Security, and
capital gains are all untaxed at the state level. No brackets or deductions
apply.

## Simplifications / not modeled
- State and local revenue relies on sales/use and (notably high) property taxes — out of scope for this individual-income-tax doc.

## Citations
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — TX listed among states with no individual income tax.
