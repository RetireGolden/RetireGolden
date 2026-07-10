# Tennessee (TN) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **no** — Tennessee has no individual income tax (the Hall tax on interest/dividends was fully repealed effective 2021).
- Taxes Social Security benefits: no (no income tax)
- Long-term capital gains: not taxed (no income tax)
- Retirement income (pension, IRA, 401k): not taxed (no income tax)

## Proposed StateTaxParams (2025)
- code: "TN"
- name: "Tennessee"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## Retirement-income detail
Tennessee has no broad individual income tax. Its former Hall income tax on
interest and dividends was phased out and fully repealed for tax years
beginning January 1, 2021. Wages, pensions, IRA/401(k) distributions, Social
Security, and capital gains are all untaxed at the state level.

## Simplifications / not modeled
- The legacy Hall tax (now repealed) is not modeled.
- State revenue relies on sales/use taxes (out of scope for this doc).

## Citations
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — TN listed among states with no individual income tax (Hall tax repealed 2021).
