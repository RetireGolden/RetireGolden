# North Carolina (NC) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 4.25% for 2025)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (flat 4.25%)
- Retirement income (pension, IRA, 401k): generally taxed; no broad exclusion (Bailey-protected government pensions exempt — see below)

## Proposed StateTaxParams (2025)
- code: "NC"
- name: "North Carolina"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 12750, marriedFilingJointly: 25500 }
- brackets.single: [ { lowerBound: 0, ratePct: 4.25 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 4.25 } ]
- retirement: { kind: "none" }

## Retirement-income detail
North Carolina taxes income at a **flat 4.25%** for 2025 (down from 4.5% in 2024).
Social Security benefits are **fully exempt**. Private pensions and IRA/401(k)
distributions are **fully taxable** (included in federal taxable income, which is
NC's starting point). There is no general age-based pension/IRA exclusion, so this
maps to `retirement: { kind: "none" }`. The standard deduction is $12,750 single /
$25,500 MFJ for 2025.

## Simplifications / not modeled
- **Bailey exemption**: federal and certain NC state/local government pensions are
  fully exempt for retirees with ≥5 years of creditable service as of Aug 12, 1989.
  Not modeled — `none` overstates tax for those specific government retirees.
- Military retirement pay (20+ years of service) is fully exempt; not modeled.
- NC's flat rate is scheduled to keep falling (3.99% in 2026); we hold the 2025
  nominal rate of 4.25% forward.
- Personal exemptions / child deduction not modeled.

## Citations
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 flat 4.25%; standard deduction $12,750 / $25,500.
- https://www.ncdor.gov/taxes-forms/individual-income-tax/filing-topics/bailey-decision-concerning-federal-state-and-local-retirement-benefits — Bailey government-pension exemption; SS fully exempt; IRA/401(k) taxable.
