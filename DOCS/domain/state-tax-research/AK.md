# Alaska (AK) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **no**
- Taxes Social Security benefits: no
- Long-term capital gains: not taxed (no income tax)
- Retirement income (pension, IRA, 401k): not taxed (no income tax)

## Proposed StateTaxParams (2025)
- code: "AK"
- name: "Alaska"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## Retirement-income detail
Alaska levies no personal income tax, so all retirement income — Social
Security, pensions, and IRA/401(k) distributions — is untaxed at the state
level. The remaining fields are inert when `hasIncomeTax` is false.

## Simplifications / not modeled
None material for retirees. (Alaska has local sales and property taxes, and pays
an annual Permanent Fund Dividend — out of scope.)

## Citations
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Alaska has no individual income tax.
