# Indiana (IN) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 3.0% state rate)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (flat 3.0%)
- Retirement income (pension, IRA, 401k): generally taxed (military retirement fully exempt)

## Proposed StateTaxParams (2025)
- code: "IN"
- name: "Indiana"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: [ { lowerBound: 0, ratePct: 3.0 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 3.0 } ]
- retirement: { kind: "none" }

## Retirement-income detail
Indiana taxes adjusted gross income at a flat **3.0%** state rate for 2025
(reduced from 3.05% in 2024 as part of a scheduled phase-down). It has **no
standard deduction**, using personal/dependent exemptions instead (see below).
Social Security benefits are fully exempt (Indiana starts from federal AGI and
follows the federal exclusion / subtracts the taxable portion).

Private pensions and IRA/401(k) distributions are **generally taxable** as
ordinary income; there is no broad pension/IRA exclusion. Military retirement
pay is fully exempt, and certain federal Civil Service annuitants get a small
age-65+ deduction. Because the common private retiree gets no exclusion, this is
mapped to `retirement: { kind: "none" }`.

## Simplifications / not modeled
- No standard deduction; Indiana grants a $1,000 personal exemption per filer ($1,000 for spouse on a joint return) plus a $500 senior add-on at AGI under $40,000. Not modeled — standardDeduction 0.
- County local income taxes (vary by county, roughly 1%–3%+) not modeled — adds materially to a resident's total rate.
- Military-retirement full exemption and federal-CSRS age-65 deduction not modeled (`none` is conservative).

## Citations
- https://nationaltaxreports.com/indiana-state-tax-rate/ — flat 3.0% Indiana rate for 2025.
- https://www.kiplinger.com/state-by-state-guide-taxes/indiana — SS exempt; pensions/IRA/401(k) taxed; military retirement exempt; county taxes.
- https://states.aarp.org/indiana/state-taxes-guide — personal exemptions ($1,000) and senior add-on; no standard deduction.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — IN flat 3.0% (state).
