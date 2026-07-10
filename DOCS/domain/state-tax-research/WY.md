# Wyoming (WY) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **no** (Wyoming has no individual income tax)
- Taxes Social Security benefits: no (no income tax at all)
- Long-term capital gains: not taxed (no income tax at all)
- Retirement income (pension, IRA, 401k): not taxed (no income tax at all)

## Proposed StateTaxParams (2025)
- code: "WY"
- name: "Wyoming"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "full" }

## Retirement-income detail
Wyoming is one of the nine states with no broad individual income tax. No wages,
investment income, Social Security, pension, or IRA/401(k) distributions are
taxed at the state level. With `hasIncomeTax: false` the other fields are
inert; `retirement: { kind: "full" }` and empty bracket arrays are set for
consistency.

## Simplifications / not modeled
- Wyoming funds itself through mineral severance taxes, sales tax (4% state),
  and property taxes — none modeled here (the planner models only individual
  income tax).

## Citations
- https://taxfoundation.org/location/wyoming/ — Wyoming has no individual income tax (2025).
- https://blog.turbotax.intuit.com/income-tax-by-state/wyoming-112749/ — no state income tax on wages, retirement, or Social Security.
