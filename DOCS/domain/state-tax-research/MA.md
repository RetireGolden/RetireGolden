# Massachusetts (MA) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 5%; +4% "millionaire" surtax on income over $1,083,150, noted but omitted)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income at 5% (short-term gains 8.5%, noted)
- Retirement income (pension, IRA, 401k): private pensions & IRA/401(k) generally taxable; government pensions exempt

## Proposed StateTaxParams (2025)
- code: "MA"
- name: "Massachusetts"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: [ { lowerBound: 0, ratePct: 5.0 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 5.0 } ]
- retirement: { kind: "none" }

## Retirement-income detail
Massachusetts taxes most income at a flat **5%** (2025). Social Security
benefits are fully exempt. **Government** pensions (e.g., MA state/teacher
systems and certain other states' public pensions) are exempt, but **private**
pensions, annuities, and traditional IRA/401(k)/403(b) distributions are fully
taxable. Because the common private-retiree case is fully taxed, this maps to
`retirement: { kind: "none" }`. Long-term capital gains are taxed at the same 5%
ordinary rate (`capitalGainsAsOrdinary: true`).

Massachusetts has **no standard deduction**; it uses personal exemptions
($4,400 single / $8,800 MFJ for 2025, plus $700 each for age 65+) which the
big-levers model does not represent — set to 0.

## Simplifications / not modeled
- 4% millionaire surtax on taxable income over **$1,083,150** (2025) omitted (out
  of planner range).
- Short-term capital gains taxed at **8.5%** not modeled; only the 5% LTCG case
  is represented.
- Personal exemptions ($4,400 / $8,800) and the additional $700 age-65 exemption
  not modeled (modeled as 0 standard deduction — overstates tax somewhat).
- Government-pension exemption not modeled (`none` overstates tax for public
  retirees).

## Citations
- https://ustax.tools/tax-by-state/massachusetts/ — 2025 flat 5% rate; 4% surtax over $1,083,150.
- https://www.mass.gov/info-details/tax-treatment-of-pensions-in-massachusetts — private pensions/IRA/401(k) taxable; government pensions exempt; SS exempt.
- https://www.mass.gov/info-details/massachusetts-personal-income-tax-exemptions — 2025 personal exemptions $4,400 / $8,800; $700 age-65; no standard deduction.
- https://smartasset.com/retirement/massachusetts-retirement-taxes — LTCG 5%, STCG 8.5%; SS exempt.
