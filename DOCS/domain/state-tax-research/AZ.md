# Arizona (AZ) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 2.5%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: preferential — 25% of net long-term gains subtracted (taxed at ordinary rate on the remainder)
- Retirement income (pension, IRA, 401k): generally taxed; only a small ($2,500) public-pension subtraction

## Proposed StateTaxParams (2025)
- code: "AZ"
- name: "Arizona"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15000, marriedFilingJointly: 30000 }
- brackets.single: [ { lowerBound: 0, ratePct: 2.5 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 2.5 } ]
- retirement: { kind: "none" }

## Retirement-income detail
Arizona taxes income at a flat **2.5%** (2025). Social Security benefits are
fully exempt. Private pensions and IRA/401(k)/403(b) distributions are **fully
taxable**; only certain public (federal/state/local) pensions get a small
subtraction of up to $2,500 per person. Because there is no broad
pension/IRA exclusion for the common private retiree, this is mapped to
`retirement: { kind: "none" }`. Arizona's standard deduction matches the federal
amount ($15,000 single / $30,000 MFJ for 2025).

## Simplifications / not modeled
- $2,500 public-pension subtraction not modeled (`none` is conservative — overstates tax for government retirees).
- Up to $2,500 military-retirement exemption not modeled.
- Capital gains: Arizona allows a **25% subtraction** for net long-term capital gains on assets acquired after 2011; we set `capitalGainsAsOrdinary: true` (no preference) — overstates tax slightly for those gains.
- Dependent tax credits ($100/$25) not modeled.

## Citations
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 flat 2.5% rate; standard deduction $15,000/$30,000.
- SmartAsset / annuityexpertadvice — SS exempt; private pensions & IRA/401(k) fully taxable; $2,500 public-pension subtraction; 25% LTCG subtraction.
