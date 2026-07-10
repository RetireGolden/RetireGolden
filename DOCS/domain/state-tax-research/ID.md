# Idaho (ID) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 5.3% above a zero-rate floor)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (with a partial deduction for certain Idaho property — see Simplifications)
- Retirement income (pension, IRA, 401k): generally taxed; only a narrow age-gated deduction for specific government/military pensions

## Proposed StateTaxParams (2025)
- code: "ID"
- name: "Idaho"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15000, marriedFilingJointly: 30000 }
- brackets.single:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 4811, ratePct: 5.3 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 0 }
  - { lowerBound: 9622, ratePct: 5.3 }
- retirement: { kind: "none" }

## Retirement-income detail
Idaho reduced its flat individual income tax rate from 5.695% to **5.3%**
effective January 1, 2025 (HB 40). The structure is effectively a single flat
rate of 5.3% applied to Idaho taxable income above a zero-rate floor of $4,811
(single) / $9,622 (married filing jointly). Social Security benefits are fully
exempt. Idaho conforms to the federal standard deduction ($15,000 single /
$30,000 MFJ for 2025).

Private pensions and IRA/401(k) distributions are **generally taxable**. Idaho's
"retirement benefits deduction" applies only to specific government pensions
(certain federal Civil Service, Idaho firefighter/police, and military
retirement) and only when the recipient is age 65+ (or 62+ and disabled), with
the deduction reduced by Social Security received. Because there is no broad
exclusion for the common private-pension/IRA retiree, this is mapped to
`retirement: { kind: "none" }`.

## Simplifications / not modeled
- Zero-rate floor ($4,811 single / $9,622 MFJ) modeled as a 0% first bracket so brackets remain monotonic.
- Government/military pension deduction (age 65+, income-reduced by SS) not modeled — `none` is conservative for those retirees.
- Idaho's capital-gains deduction (60% of net gain on qualifying Idaho real/tangible property) not modeled; `capitalGainsAsOrdinary: true` overstates tax for those gains.
- Senior, grocery-credit, and tip/overtime deductions not modeled.

## Citations
- https://tax.idaho.gov/pressrelease/whats-new-for-2025-income-tax-returns/ — 5.3% rate for 2025, federal-conforming standard deduction, SS exempt.
- https://www.paylocity.com/resources/tax-compliance/alerts/idaho-lowers-2025-state-income-tax-rate/ — HB 40 lowered rate from 5.695% to 5.3% effective 1/1/2025.
- https://remotelaws.com/state-income-tax/us-states/idaho/ — 5.3% flat above $4,811 single / $9,622 MFJ zero-rate floor.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — ID flat 5.3%.
