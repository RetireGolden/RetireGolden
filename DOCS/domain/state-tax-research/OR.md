# Oregon (OR) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 4.75%–9.9% — among the highest in the U.S.)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): generally taxed (no broad exclusion); narrow federal/PERS subtractions only

## Proposed StateTaxParams (2025)
- code: "OR"
- name: "Oregon"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 2835, marriedFilingJointly: 5670 }
- brackets.single:
  - { lowerBound: 0, ratePct: 4.75 }
  - { lowerBound: 4050, ratePct: 6.75 }
  - { lowerBound: 10200, ratePct: 8.75 }
  - { lowerBound: 125000, ratePct: 9.9 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 4.75 }
  - { lowerBound: 8100, ratePct: 6.75 }
  - { lowerBound: 20400, ratePct: 8.75 }
  - { lowerBound: 250000, ratePct: 9.9 }
- retirement: { kind: "none" }

## Retirement-income detail
Oregon's individual income tax is steeply graduated, topping out at **9.9%** on
income above $125,000 (single) / $250,000 (MFJ) — one of the highest top rates
in the country. Social Security benefits are fully exempt. Private pensions and
IRA/401(k) distributions are generally **fully taxable**; only narrow
subtractions apply (federal pension for pre-Oct-1991 service; partial PERS for
pre-Aug-1995 service). Because there is no broad pension/IRA exclusion for the
common private retiree, this is mapped to `retirement: { kind: "none" }`.
Standard deduction is $2,835 (single) / $5,670 (MFJ). MFJ thresholds are double
single for the first three brackets; the top 9.9% bracket starts at $250,000
MFJ (2× the $125,000 single threshold).

## Simplifications / not modeled
- Federal-pension and PERS partial subtractions (service-date dependent) not modeled (`none` is conservative).
- Oregon's Retirement Income Credit and Elderly/Disabled credit (income-tested) not modeled.
- Extra standard deduction of $1,200 (single) / $1,000 per eligible person (joint) for age 65+/blind not modeled.
- $256-per-exemption personal exemption credit (a credit, not a deduction) not modeled.
- Local transit/county taxes (e.g. Portland-area Metro/Multnomah) not modeled.

## Citations
- https://www.oregon.gov/dor/forms/FormsPubs/publication-or-17_101-431_2025.pdf — 2025 Publication OR-17: standard deduction $2,835 single / $5,670 MFJ; SS exempt.
- https://ustax.tools/oregon-tax-brackets-2025/ — 2025 single and MFJ bracket thresholds (4.75%/6.75%/8.75%/9.9%).
- https://nationaltaxreports.com/oregon-taxes-on-pensions-iras-and-401ks/ — pensions/IRA/401(k) generally taxable; SS exempt.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — OR top rate 9.9%.
