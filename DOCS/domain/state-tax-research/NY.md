# New York (NY) — state income tax for retirement planning

Tax year: 2025. (Completed example — already in `year2026.ts`.)

## Summary
- Broad individual income tax: **yes** (graduated, 4%–10.9%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income: government/military pensions fully exempt; private pension & IRA/401(k) excluded up to $20,000 per person at 59½+

## Proposed StateTaxParams (2025)
- code: "NY"
- name: "New York"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 8000, marriedFilingJointly: 16050 }
- brackets.single:
  - { lowerBound: 0, ratePct: 4.0 }
  - { lowerBound: 8500, ratePct: 4.5 }
  - { lowerBound: 11700, ratePct: 5.25 }
  - { lowerBound: 13900, ratePct: 5.5 }
  - { lowerBound: 80650, ratePct: 6.0 }
  - { lowerBound: 215400, ratePct: 6.85 }
  - { lowerBound: 1077550, ratePct: 9.65 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 4.0 }
  - { lowerBound: 17150, ratePct: 4.5 }
  - { lowerBound: 23600, ratePct: 5.25 }
  - { lowerBound: 27900, ratePct: 5.5 }
  - { lowerBound: 161550, ratePct: 6.0 }
  - { lowerBound: 323200, ratePct: 6.85 }
  - { lowerBound: 2155350, ratePct: 9.65 }
- retirement: { kind: "capped", capPerPerson: 20000, minAge: 59 }

## Retirement-income detail
NY fully exempts Social Security and NY/federal government and military
pensions. Private pensions and IRA/401(k) distributions are excluded up to
**$20,000 per person** once the recipient is 59½+. Modeled as `kind: "capped"`,
`capPerPerson: 20000`, `minAge: 59`. Top brackets above ~$1.08M (5M MFJ tiers
at 10.3%/10.9%) are omitted as out-of-range for the planner's audience.

## Simplifications / not modeled
- Full exemption of government/military pensions approximated by the $20k private cap (conservative for those retirees).
- NYC/Yonkers local income taxes not modeled.
- Top 10.3%/10.9% millionaire brackets omitted; tax-benefit recapture omitted.

## Citations
- https://www.tax.ny.gov/ — 2024 brackets, $20,000 pension/annuity exclusion, SS exempt.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — NY.
