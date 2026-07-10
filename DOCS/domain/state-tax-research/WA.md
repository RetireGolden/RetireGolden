# Washington (WA) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **no** (Washington has no broad individual income tax)
- Taxes Social Security benefits: no (no income tax on ordinary income)
- Long-term capital gains: a **7% excise tax** applies to net long-term gains above a ~$278,000 annual exemption (9.9% above $1M) — see Simplifications
- Retirement income (pension, IRA, 401k): not taxed (no income tax; retirement accounts also exempt from the capital-gains tax)

## Proposed StateTaxParams (2025)
- code: "WA"
- name: "Washington"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "full" }

## Retirement-income detail
Washington has no broad individual income tax. Wages, Social Security, pensions,
and IRA/401(k) distributions are not taxed at the state level. The only
income-like state tax is a 7% excise tax on the sale of long-term capital
assets (stocks, bonds, business interests), and that tax explicitly exempts
retirement-account distributions and real estate. With `hasIncomeTax: false`
the bracket/retirement fields are inert.

## Simplifications / not modeled
- **Washington capital-gains excise tax**: 7% on net long-term gains above a
  standard deduction of **$278,000** for 2025 (inflation-indexed), with an
  additional tier bringing the rate to **9.9%** on gains above $1,000,000.
  Real estate, retirement accounts, and many small-business sales are exempt.
  Set `hasIncomeTax: false` because it does not function as a broad income tax
  and rarely affects typical retirees; flagged here for completeness. A future
  enhancement could add a dedicated CG-excise module for high-gain years.

## Citations
- https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax — 7% capital gains excise tax; standard deduction (~$278k 2025); retirement accounts and real estate exempt.
- https://www.kiplinger.com/taxes/new-washington-capital-gains-tax-increases — 2025 additional 2.9% tier (9.9% total) above $1M.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Washington has no broad individual income tax (2025).
