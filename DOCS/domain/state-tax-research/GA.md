# Georgia (GA) — state income tax for retirement planning

Tax year: 2026. Researched 2026-06-13; re-verified against the GA DOR 2026 updates page 2026-07-15
(PR #22 review caught the 2025 vintage going stale — the rate ramp moved faster than the hold-forward
convention assumed).

## Summary
- Broad individual income tax: **yes** (flat 4.99% for 2026)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): large age-based exclusion — $35,000 per person at 62–64, $65,000 per person at 65+

## Proposed StateTaxParams (2026)
- code: "GA"
- name: "Georgia"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15000, marriedFilingJointly: 30000 }
- brackets.single: [ { lowerBound: 0, ratePct: 4.99 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 4.99 } ]
- retirement: { kind: "capped", capPerPerson: 65000, minAge: 65 }

## Retirement-income detail
Georgia's flat rate is on a legislated ramp and has moved quickly: **5.39%** for 2024, cut
**retroactively to 5.19%** for tax years beginning January 1, 2025 (per the DOR's updated 2025
employer guide), and published at **4.99%** for 2026 with standard deductions raised to **$15,000
(single) / $30,000 (MFJ)** — the values encoded in the 2026 pack. Social Security is fully exempt.

Georgia's **Retirement Income Exclusion** is large and age-based: taxpayers
**65+** may exclude up to **$65,000 per person** of retirement income (pensions,
IRA/401(k) distributions, interest, dividends, capital gains, plus up to $4,000 of
earned income); taxpayers **62–64** (or under 62 and permanently disabled) may
exclude up to **$35,000 per person**. Modeled as `kind: "capped"`,
`capPerPerson: 65000`, `minAge: 65` (the dominant retiree case).

## Simplifications / not modeled
- The 62–64 tier ($35,000 per person) is not modeled separately; only the 65+ ($65,000) tier is captured via `minAge: 65`.
- The exclusion covers broad investment income and up to $4,000 of earned income, not just pension/IRA; modeled narrowly as the pension/IRA cap.
- GA's flat rate is on a legislated annual ramp — do **not** hold it forward at refresh time; re-read the DOR updates page each year (the 2025→2026 hold-forward went stale mid-year).

## Citations
- https://dor.georgia.gov/taxes/important-tax-updates — "2026 Income Tax Changes": flat 4.99%; standard deduction $15,000 single / $30,000 MFJ. Accessed 2026-07-15.
- https://dor.georgia.gov/document/document-document/2025-employers-tax-guide-updated-june-2025/download — 2025 rate reduced retroactively from 5.39% to 5.19% (tax years beginning 2025-01-01).
- https://dor.georgia.gov/retirement-income-exclusion — Retirement Income Exclusion: $35,000 (62–64) / $65,000 (65+) per person; worksheet amounts in Form IT-511.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation cross-check.
