# Delaware (DE) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 0%–6.6%; same brackets for all filing statuses)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): exclusion up to $12,500 per person at age 60+ ($2,000 if under 60)

## Proposed StateTaxParams (2025)
- code: "DE"
- name: "Delaware"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 5700, marriedFilingJointly: 11400 }
- brackets.single:
  - { lowerBound: 0, ratePct: 0.0 }
  - { lowerBound: 2000, ratePct: 2.2 }
  - { lowerBound: 5000, ratePct: 3.9 }
  - { lowerBound: 10000, ratePct: 4.8 }
  - { lowerBound: 20000, ratePct: 5.2 }
  - { lowerBound: 25000, ratePct: 5.5 }
  - { lowerBound: 60000, ratePct: 6.6 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 0.0 }
  - { lowerBound: 2000, ratePct: 2.2 }
  - { lowerBound: 5000, ratePct: 3.9 }
  - { lowerBound: 10000, ratePct: 4.8 }
  - { lowerBound: 20000, ratePct: 5.2 }
  - { lowerBound: 25000, ratePct: 5.5 }
  - { lowerBound: 60000, ratePct: 6.6 }
- retirement: { kind: "capped", capPerPerson: 12500, minAge: 60 }

## Retirement-income detail
Delaware has a graduated tax with a $0 first bracket (first $2,000 untaxed) up to
6.6%. The bracket **thresholds are identical for single and MFJ** (Delaware does
not double them for joint filers) — verified, not assumed. The 2025 standard
deduction is **$5,700 (single) / $11,400 (MFJ)** (raised from $3,250/$6,500 for
tax years after 2023).

Delaware fully exempts Social Security. Taxpayers **age 60 or older** may exclude
up to **$12,500 per person** of eligible retirement income (pension, 401(k), IRA,
dividends/interest/capital gains, etc.); those under 60 may exclude up to $2,000
of pension income. Modeled as `kind: "capped"`, `capPerPerson: 12500`,
`minAge: 60` (the common retiree case).

## Simplifications / not modeled
- The $12,500 exclusion covers a broad set of investment income, not just pension/IRA; modeled narrowly as the pension/IRA cap.
- Under-60 $2,000 pension exclusion not modeled.
- Additional standard deduction for taxpayers 65+ / blind not modeled.
- Personal-credit ($110) and other credits not modeled.

## Citations
- https://www.incometaxpro.com/tax-rates/delaware.htm — 2025 brackets 0%–6.6%; identical thresholds for single and MFJ.
- https://law.justia.com/codes/delaware/title-30/chapter-11/subchapter-ii/section-1108/ — 30 Del. C. § 1108: standard deduction $5,700 / $11,400 for periods after 12/31/2023.
- https://revenue.delaware.gov/tax-season-updates/ — Delaware Division of Revenue 2025 updates (few changes; SALT cap raised).
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation 2025 cross-check (DE 2.2%–6.6%).
