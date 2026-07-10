# Iowa (IA) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 3.8%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (with limited exclusions — see Simplifications)
- Retirement income (pension, IRA, 401k): **fully exempt** for taxpayers age 55+ (also disabled / surviving spouses)

## Proposed StateTaxParams (2025)
- code: "IA"
- name: "Iowa"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15000, marriedFilingJointly: 30000 }
- brackets.single: [ { lowerBound: 0, ratePct: 3.8 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 3.8 } ]
- retirement: { kind: "full", minAge: 55 }

## Retirement-income detail
Iowa moved to a flat **3.8%** individual income tax for 2025 (SF 2442),
eliminating its prior graduated brackets. Iowa also dropped its own standard
deduction and now conforms to the **federal** standard deduction ($15,000 single
/ $30,000 MFJ for 2025). Social Security benefits are fully exempt.

For tax years beginning 2023 and later, Iowa fully excludes retirement income —
pensions (defined benefit and defined contribution), annuities, IRA
distributions, and deferred-compensation distributions — for individuals who are
**age 55 or older** on December 31 of the tax year (also for disabled
individuals, surviving spouses, and qualifying survivors). Mapped to
`retirement: { kind: "full", minAge: 55 }`, modeling the common age-based case.

## Simplifications / not modeled
- Disabled / surviving-spouse / survivor eligibility paths (which can apply under age 55) not modeled — only the age-55 path is captured.
- Iowa's elimination of its separate standard/itemized deductions in favor of the federal amount means federal-conforming figures are used; high-earner federal phase-outs not modeled.
- Iowa capital-gain exclusions (e.g., qualifying ESOP/farm/business-asset gains) not modeled; `capitalGainsAsOrdinary: true` overstates tax for those gains.

## Citations
- https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/individual-income-tax-provisions — flat 3.8% 2025; retirement income exclusion age 55+; SS exempt.
- https://www.law.cornell.edu/regulations/iowa/Iowa-Admin-Code-r-701-302-47 — exclusion of pensions/IRA/annuity for age 55+, disabled, surviving spouses, survivors (tax years 2023+).
- https://nationaltaxreports.com/iowa-standard-deduction-2025-2026-guide/ — Iowa now follows the federal standard deduction.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — IA flat 3.8%.
