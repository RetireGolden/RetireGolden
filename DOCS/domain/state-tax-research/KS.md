# Kansas (KS) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (two brackets, 5.2% and 5.58%)
- Taxes Social Security benefits: no (fully exempt for all taxpayers since tax year 2024)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): private pensions/IRA/401(k) generally taxed; public (federal/state/KPERS/military/railroad) pensions exempt

## Proposed StateTaxParams (2025)
- code: "KS"
- name: "Kansas"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 3605, marriedFilingJointly: 8240 }
- brackets.single:
  - { lowerBound: 0, ratePct: 5.2 }
  - { lowerBound: 23000, ratePct: 5.58 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 5.2 }
  - { lowerBound: 46000, ratePct: 5.58 }
- retirement: { kind: "none" }

## Retirement-income detail
Kansas (after the 2024 reforms, SB 1 / HB 2036) has a two-bracket structure for
2025: **5.2%** on taxable income up to $23,000 (single) / $46,000 (MFJ), and
**5.58%** above that. Standard deduction is $3,605 single / $8,240 MFJ (2025).

Social Security benefits are **fully exempt** for all taxpayers beginning with
tax year 2024 — Kansas removed the prior $75,000 AGI cliff (SB 1, 2024 special
session). Public pensions are exempt (federal Civil Service, military, railroad
retirement, KPERS state/local). However, **private** pensions and IRA/401(k)
distributions are taxed as ordinary income, so the common private retiree gets
no exclusion → `retirement: { kind: "none" }`.

## Simplifications / not modeled
- Exemption of public/government/KPERS/military/railroad pensions not modeled — `none` is conservative (overstates tax for those retirees).
- Kansas personal exemption ($9,160 single / $18,320 MFJ plus $2,320/dependent, 2025) not modeled — only the standard deduction is captured, which understates total deductions/exemptions and overstates tax.
- Age-65 additional standard deduction add-ons not modeled.

## Citations
- https://remotelaws.com/state-income-tax/us-states/kansas/ — 2025 two brackets 5.20%/5.58% at $23,000 single / $46,000 MFJ.
- https://www.ksrevenue.gov/incomebook25.html — Kansas DOR 2025 income tax booklet (rates, standard deduction).
- https://legalclarity.org/kansas-social-security-taxation-rules-exemptions-and-changes/ — SS fully exempt for tax years after 12/31/2023 (SB 1 removed $75k cap).
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — KS 5.2%/5.58%.
