# Florida (FL) — state income tax for retirement planning

Tax year: 2025. (Completed example — already in `year2026.ts`.)

## Summary
- Broad individual income tax: **no**
- Taxes Social Security benefits: no
- Long-term capital gains: not taxed (no income tax)
- Retirement income (pension, IRA, 401k): not taxed (no income tax)

## Proposed StateTaxParams (2025)
- code: "FL"
- name: "Florida"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## Retirement-income detail
Florida levies no personal income tax, so all retirement income is untaxed at
the state level. The remaining fields are inert when `hasIncomeTax` is false.

## Simplifications / not modeled
None material for retirees. (Florida has property and sales taxes, out of scope.)

## Citations
- https://floridarevenue.com/taxes/taxesfees/Pages/default.htm — Florida has no individual income tax.
