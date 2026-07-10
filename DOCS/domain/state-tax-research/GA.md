# Georgia (GA) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 5.39%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): large age-based exclusion — $35,000 per person at 62–64, $65,000 per person at 65+

## Proposed StateTaxParams (2025)
- code: "GA"
- name: "Georgia"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 12000, marriedFilingJointly: 24000 }
- brackets.single: [ { lowerBound: 0, ratePct: 5.39 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 5.39 } ]
- retirement: { kind: "capped", capPerPerson: 65000, minAge: 65 }

## Retirement-income detail
Georgia taxes income at a flat **5.39%** (2025; scheduled to keep declining toward
4.99%). Social Security is fully exempt. The standard deduction is **$12,000
(single) / $24,000 (MFJ)** for 2025.

Georgia's **Retirement Income Exclusion** is large and age-based: taxpayers
**65+** may exclude up to **$65,000 per person** of retirement income (pensions,
IRA/401(k) distributions, interest, dividends, capital gains, plus up to $4,000 of
earned income); taxpayers **62–64** (or under 62 and permanently disabled) may
exclude up to **$35,000 per person**. Modeled as `kind: "capped"`,
`capPerPerson: 65000`, `minAge: 65` (the dominant retiree case).

## Simplifications / not modeled
- The 62–64 tier ($35,000 per person) is not modeled separately; only the 65+ ($65,000) tier is captured via `minAge: 65`.
- The exclusion covers broad investment income and up to $4,000 of earned income, not just pension/IRA; modeled narrowly as the pension/IRA cap.
- Some secondary sources cite an $18,000 MFJ standard deduction; the GA DOR confirms $12,000 single / $24,000 MFJ for 2025 (used here).
- GA's flat rate continues to decline annually; we hold the 2025 nominal 5.39% forward.

## Citations
- https://dor.georgia.gov/retirement-income-exclusion — Retirement Income Exclusion: $35,000 (62–64) / $65,000 (65+) per person.
- https://dor.georgia.gov/taxes/important-tax-updates — Georgia 2025 flat rate 5.39%.
- https://blog.turbotax.intuit.com/income-tax-by-state/georgia-108612/ — 2025 flat 5.39%; SS exempt.
- https://dor.georgia.gov/georgia-standard-deductions-increases — GA DOR: 2025 standard deduction $12,000 single / $24,000 MFJ.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation 2025 cross-check (GA flat ~5.39%, std deduction $12,000/$24,000).
