# Maryland (MD) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 2%–6.5%; new 6.25%/6.5% top tiers added for 2025)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (plus a new 2% surtax on net capital gains when federal AGI > $350,000, omitted)
- Retirement income (pension, IRA, 401k): age-65+ pension exclusion up to $41,200 per person (employer plans only; reduced by Social Security)

## Proposed StateTaxParams (2025)
- code: "MD"
- name: "Maryland"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 3350, marriedFilingJointly: 6700 }
- brackets.single:
  - { lowerBound: 0, ratePct: 2.0 }
  - { lowerBound: 1000, ratePct: 3.0 }
  - { lowerBound: 2000, ratePct: 4.0 }
  - { lowerBound: 3000, ratePct: 4.75 }
  - { lowerBound: 100000, ratePct: 5.0 }
  - { lowerBound: 125000, ratePct: 5.25 }
  - { lowerBound: 150000, ratePct: 5.5 }
  - { lowerBound: 250000, ratePct: 5.75 }
  - { lowerBound: 500000, ratePct: 6.25 }
  - { lowerBound: 1000000, ratePct: 6.5 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 2.0 }
  - { lowerBound: 1000, ratePct: 3.0 }
  - { lowerBound: 2000, ratePct: 4.0 }
  - { lowerBound: 3000, ratePct: 4.75 }
  - { lowerBound: 150000, ratePct: 5.0 }
  - { lowerBound: 175000, ratePct: 5.25 }
  - { lowerBound: 225000, ratePct: 5.5 }
  - { lowerBound: 300000, ratePct: 5.75 }
  - { lowerBound: 600000, ratePct: 6.25 }
  - { lowerBound: 1200000, ratePct: 6.5 }
- retirement: { kind: "capped", capPerPerson: 41200, minAge: 65 }

## Retirement-income detail
Maryland fully exempts Social Security benefits. It offers a **pension
exclusion** of up to **$41,200 per person** (2025) for taxpayers who are age 65
or older (or totally/permanently disabled). The exclusion applies to
distributions from qualified employer retirement plans (401(k), 403(b), 457(b),
defined-benefit pensions). Modeled as `kind: "capped"`, `capPerPerson: 41200`,
`minAge: 65`. The standard deduction is capped at $3,350 (single) / $6,700 (MFJ)
for 2025 (Maryland's standard deduction is 15% of AGI within min/max bounds; the
maximum applies for any retiree above ~$22k AGI).

## Simplifications / not modeled
- Strictly, IRA distributions do **not** qualify for the pension exclusion (only
  employer plans do); we map the exclusion to retirement.kind = "capped" which the
  engine applies to pension + IRA/401(k) collectively — this overstates the
  exclusion for IRA-heavy retirees.
- The pension exclusion is **reduced dollar-for-dollar by Social Security
  benefits received**; not modeled, so the cap is generous for SS recipients.
- Maryland also has a separate age-65 "senior tax credit" and a $34,300
  retired-military exclusion — not modeled.
- Maryland counties levy a **local income tax** (~2.25%–3.2%); not modeled.
- New 2% surtax on net capital gains when federal AGI > $350,000 omitted
  (`capitalGainsAsOrdinary: true`).
- Standard deduction is technically 15%-of-AGI-bounded; modeled at the maximum.

## Citations
- https://blog.turbotax.intuit.com/income-tax-by-state/maryland-105400/ — full 2025 single & MFJ bracket schedule (2%–6.5%, incl. new 6.25%/6.5% tiers); standard deduction $3,350 / $6,700.
- https://www.gfrlaw.com/what-we-do/insights/maryland-tax-alert-2025 — 2025 new 6.25%/6.5% brackets and 2% capital-gains surtax over $350k AGI.
- https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/worksheets/Pension-Exclusion-Worksheet.pdf — 2025 pension exclusion $41,200; age-65 requirement; employer-plan qualifying income; SS offset.
- https://legalclarity.org/how-does-maryland-tax-retirement-income/ — SS fully exempt; pension exclusion mechanics.
