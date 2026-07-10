# Nevada (NV) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **no** (none — constitutionally prohibited)
- Taxes Social Security benefits: no (no income tax at all)
- Long-term capital gains: not taxed (no income tax)
- Retirement income (pension, IRA, 401k): not taxed (no income tax)

## Proposed StateTaxParams (2025)
- code: "NV"
- name: "Nevada"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## Retirement-income detail
Nevada levies **no individual income tax** of any kind. The Nevada Constitution
(Article 10, Section 1) prohibits a tax on wages or personal income of natural
persons. Wages, Social Security, pensions, IRA/401(k) distributions, and capital
gains are all untaxed at the state level. `hasIncomeTax: false`; the other fields
are inert.

## Simplifications / not modeled
- Nevada raises revenue through sales tax (6.85% state rate) and a gross-receipts
  (Commerce) tax on businesses; neither affects an individual retiree's income.

## Citations
- https://taxfoundation.org/location/nevada/ — Nevada has no individual income tax (2025/2026).
- https://taxfoundation.org/statetaxindex/states/nevada/ — confirms no income tax; sales/gross-receipts revenue mix.
