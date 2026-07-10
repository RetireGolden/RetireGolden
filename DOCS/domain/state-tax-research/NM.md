# New Mexico (NM) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 1.5%–5.9%; brackets restructured for 2025)
- Taxes Social Security benefits: **yes, but only above high income thresholds** (exempt under $100k single / $150k MFJ federal AGI)
- Long-term capital gains: effectively taxed as ordinary income (small net-capital-gain deduction — see below)
- Retirement income (pension, IRA, 401k): generally taxed; modest age-65 deduction up to $8,000 (income-limited)

## Proposed StateTaxParams (2025)
- code: "NM"
- name: "New Mexico"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15750, marriedFilingJointly: 31500 }
- brackets.single:
  - { lowerBound: 0, ratePct: 1.5 }
  - { lowerBound: 5500, ratePct: 3.2 }
  - { lowerBound: 16500, ratePct: 4.3 }
  - { lowerBound: 33500, ratePct: 4.7 }
  - { lowerBound: 66500, ratePct: 4.9 }
  - { lowerBound: 210000, ratePct: 5.9 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 1.5 }
  - { lowerBound: 8000, ratePct: 3.2 }
  - { lowerBound: 25000, ratePct: 4.3 }
  - { lowerBound: 50000, ratePct: 4.7 }
  - { lowerBound: 100000, ratePct: 4.9 }
  - { lowerBound: 315000, ratePct: 5.9 }
- retirement: { kind: "none" }

## Retirement-income detail
New Mexico's brackets were **restructured for 2025** into six rates (1.5% to 5.9%).
Social Security benefits are **exempt for the large majority of retirees**: fully
deductible when federal AGI is under $100,000 (single) / $150,000 (MFJ); above
those thresholds SS becomes taxable. Because the planner's typical audience falls
under the threshold, this is modeled as `taxesSocialSecurity: false` — see the
flag below for high-income retirees.

Private pensions and IRA/401(k) distributions are taxable. Taxpayers age 65+ may
deduct up to **$8,000** of income (income-limited, and not specific to pensions),
which is small and means-tested, so retirement is mapped to
`retirement: { kind: "none" }`. NM's standard deduction follows the federal amount
($15,750 single / $31,500 MFJ for 2025).

## Simplifications / not modeled
- **Social Security**: modeled as not taxed. This is wrong for retirees above
  $100k single / $150k MFJ federal AGI, who must include SS — understates tax for them.
- **Age-65 $8,000 deduction** (income-limited) not modeled; `none` is conservative.
- **Capital gains**: starting 2025 the old "greater of $1,000 or 40%" deduction is
  cut to the **greater of $1,000 or 40% capped at $2,500** for general gains (the
  40% applies more broadly only to NM-business sales). The $2,500 cap is small, so
  we treat gains as ordinary (`capitalGainsAsOrdinary: true`) — slightly overstates tax.
- Standard deduction tied to federal amount; Tax Foundation's table rounds it to
  $15,000 / $30,000 — we use the actual 2025 federal $15,750 / $31,500.
- Low- and middle-income credits / rebates not modeled.

## Citations
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 single & MFJ brackets and thresholds (1.5%–5.9%).
- https://www.tax.newmexico.gov/social-security-income-tax-exemption/ — SS exempt under $100k single / $150k MFJ federal AGI.
- https://learn.valur.com/new-mexico-capital-gains-tax/ — 2025 capital-gains deduction capped at $2,500 for general gains.
- https://support.taxslayer.com/hc/en-us/articles/360028355972 — IRA/401(k)/pension taxable; age-65 $8,000 income-limited deduction.
